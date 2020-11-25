#!/usr/bin/env node

/* Copyright (c) 2019 Groundswell Cloud Solutions Inc. - All Rights Reserved
*
* THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF
* ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
* OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
* IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
* DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
* OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
* USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
/* TODO: All the commands should be in one folder, remove the code not as commands to
services file and put those files in separate services folder */
const shellJS = require('shelljs');
const emoji = require('node-emoji');
const fs = require('fs-extra');
const program = require('commander');
const extract = require('extract-zip');
const path = require('path');
const tableify = require('tableify');
const xml2js = require('xml2js');


const authenticate = require('./authenticate');
const deploymentInfoService = require('./deploymentInfoService');
const gitUtils = require('./gitUtils');
const notify = require('./utils/notificationsUtil');
const logger = require('./utils/logger');

const projectPath = process.env.PROJECT_PATH || '.';

const FAILURE = 'Failure';
const SUCCESS = 'Success';
const ARTIFACTS_DIR_NAME = 'Artifacts';
const MDAPI_PACKAGE_GROUP = process.env.MDAPI_PACKAGE_GROUP_NAME ? process.env.MDAPI_PACKAGE_GROUP_NAME : 'metadatapackage-group';
const MDAPI_PACKAGE_NAME = process.env.MDAPI_PACKAGE_NAME ? process.env.MDAPI_PACKAGE_NAME : 'mdapiPackage';
const NO_CODE_COVERAGE_INFO = 'No Code Coverage Info';
const WAIT_TIME = process.env.WAIT_TIME || -1;

const {
    SF_USERNAME, SF_ENV_TYPE, ZIPPED_ARTIFACT,
    SF_PASSWORD, GIT_SUCCESS_TAG, LATEST_COMMIT_HASH_TAG,
    SLACK_NOTIFICATION_URI, MIN_OVERALL_CODE_COVERAGE,
} = process.env;

const generateReleaseNotes = (jsonString, locationToStore, type) => {
    const jsonObject = JSON.parse(jsonString);
    logger.debug('Directory: ', path.dirname(__dirname));
    logger.debug('locationToStore: ', locationToStore);
    const cssFilePath = path.join(path.dirname(__dirname), 'styles', 'tableify.css');
    logger.debug('cssFilePath ', cssFilePath);
    const css = fs.readFileSync(cssFilePath);
    const html = `<html><style>${css}</style>${tableify(jsonObject)}</html>`;
    const epochTime = Math.floor(new Date() / 1000);
    const filePathForHTML = path.join(locationToStore, `deploymentResults_${type}_${epochTime}.html`);
    const filePathForJSON = path.join(locationToStore, `deploymentResults_${type}_${epochTime}.json`);
    logger.debug('filePathForHTML: ', filePathForHTML);
    logger.debug('filePathForJSON: ', filePathForJSON);
    fs.writeFileSync(filePathForHTML, html);
    fs.writeFileSync(filePathForJSON, jsonString);
};

function getTestsClasses(artifactPath) {
    return new Promise((resolve, reject) => {
        try {
            if (fs.existsSync(`${artifactPath}/testSuites`)) {
                logger.debug('testSuites exists');
                const testClasses = [];
                fs.readdir(`${artifactPath}/testSuites`)
                    .then((files) => {
                        files.forEach((file) => {
                            logger.debug(file);
                            const data = fs.readFileSync(`${artifactPath}/testSuites/${file}`);
                            const parser = new xml2js.Parser({ explicitArray: false });
                            parser.parseString(data, (error, result) => {
                                if (error) {
                                    reject(error);
                                }
                                logger.debug(result);
                                if (result.ApexTestSuite && result.ApexTestSuite.testClassName) {
                                    // resolve(result.ApexTestSuite.testClassName.toString());
                                    testClasses.push(result.ApexTestSuite.testClassName);
                                }
                            });
                        });
                        logger.debug('testClasses: ', testClasses);
                        logger.debug('testClasses: ', testClasses.toString());
                        if (testClasses.length > 0) {
                            resolve(testClasses.toString());
                        }
                        resolve('');
                    })
                    .catch((error) => {
                        reject(error);
                    });
            } else {
                resolve('');
            }
        } catch (exception) {
            reject(exception);
        }
    });
}

/**
 * @return {*}
 * @param {*} srcProjectPath
 * @param {*} targetUserName
 * @param {*} dependenciesFilePath
 */
function srcArtifactDeployOneByOne(srcProjectPath, targetUserName,
    dependenciesFilePath) {
    // Will run if undefined i.e third argument is not passed
    return new Promise((resolve, reject) => {
        try {
            logger.debug(srcProjectPath, targetUserName, dependenciesFilePath);
            let packageObj;
            /* Reading the dependencies file based on the location provided as param,
      If not provided, it will consider sfdx-project.json as the dependencies
      file */
            if (dependenciesFilePath) {
                packageObj = fs.readJSONSync(`${dependenciesFilePath}`);
            } else {
                packageObj = fs.readJSONSync(`${srcProjectPath}/sfdx-project.json`);
            }

            // Change the working directory to the project path provided as param
            shellJS.cd(`${srcProjectPath}`);

            /* Looping through based on dependencies and deploying each modules
      one by one to the target org */
            packageObj.packageDirectories.forEach((element) => {
                // logger.debug(emoji.emojify(`:rocket:  Deploying ${element.path}................................... :rocket:`));
                logger.debug(`Deploying ${element.path}...................................`);
                logger.debug(`sfdx force:source:deploy -p ./${element.path}  --json --wait 20 --targetusername ${targetUserName}`);
                // shellJS commands works synchronously by default
                shellJS.exec(`sfdx force:source:deploy -p ./${element.path}  --json --wait 20 --targetusername ${targetUserName}`);
            });
            resolve('Successfull.....');
        } catch (exception) {
            reject(exception);
        }
    });
}

/**
 *
 * @param {*} artifactPath
 * @param {*} targetUserName
 * @param {*} validate
 * @param {*} testLevel
 * @param {*} testsToRun
 * @param runSpecifiedTests
 * @param uri
 * @param minBuildCoverage
 * @return {*}
 */
function prepareAndCallMDDeployCommand(artifactPath, targetUserName,
    validate, testLevel, testsToRun, runSpecifiedTests, uri,
    minBuildCoverage = 75, minCodeCoveragePerCmp = 75,
    notificationTitle) {
    // Will run if undefined i.e third argument is not passed
    return new Promise((resolve, reject) => {
        try {
            logger.debug('uri: ', uri);
            let command = `SFDX_JSON_TO_STDOUT=true sfdx force:mdapi:deploy --deploydir ${artifactPath} --json --wait ${WAIT_TIME} --verbose --targetusername ${targetUserName}`;
            if (validate === true || (validate && validate.toLowerCase() === 'true')) {
                command += ' --checkonly';
            }
            let defaultTestLevel = 'NoTestRun';
            if (testLevel) {
                defaultTestLevel = testLevel;
            }
            if (runSpecifiedTests) {
                defaultTestLevel = 'RunSpecifiedTests';
            }
            command += ` --testlevel ${defaultTestLevel}`;
            if (defaultTestLevel === 'RunSpecifiedTests') {
                if (testsToRun === '') {
                    reject(new Error('There should be test classes with this build'));
                } else {
                    command += ` --runtests ${testsToRun}`;
                }
            }
            logger.debug('command: ', command);
            shellJS.exec(command, (status, stdout, stderr) => {
                logger.debug('status: ', status);
                if (status === 0) {
                    const outputJSON = JSON.parse(stdout);
                    logger.debug('outputJSON: ', outputJSON);
                    // Generate Success Release Notes as Artifacts
                    generateReleaseNotes(stdout, path.dirname(artifactPath), SUCCESS);
                    // Send Success Notification to Slack
                    if (uri) {
                        logger.debug('About to send notification');

                        // Get Code Coverage for the build
                        const codeCoverageResults = notify.calculateOverallCodeCoverage(JSON.parse(stdout), parseInt(minCodeCoveragePerCmp));
                        if (codeCoverageResults !== NO_CODE_COVERAGE_INFO && (codeCoverageResults.overallBuildCodeCoverage < parseInt(minBuildCoverage) || codeCoverageResults.cmpsWithLessCodeCoverage.length > 0)) {
                            logger.debug('Minimum Build Coverage: ', parseInt(minBuildCoverage));
                            logger.debug('codeCoverageResults.cmpsWithLessCodeCoverage.length: ', codeCoverageResults.cmpsWithLessCodeCoverage.length);
                            notify.generateFailureNotificationForSlack(stdout, minCodeCoveragePerCmp, codeCoverageResults, validate, notificationTitle).then(message => notify.sendNotificationToSlack(uri, message))
                                .then((result) => {
                                    reject(result);
                                })
                                .catch((error) => {
                                    logger.error('$$error: ', error);
                                    reject(error);
                                });
                        } else {
                            notify.generateSuccessNotificationForSlack(codeCoverageResults, validate, notificationTitle).then(message => notify.sendNotificationToSlack(uri, message))
                                .then((result) => {
                                    resolve(result);
                                })
                                .catch((error) => {
                                    logger.error('$$error: ', error);
                                    resolve('Error is there');
                                });
                        }
                        // Send Failure Notification to Slack
                    } else {
                        resolve('Deployment Successful');
                    }
                    // if (validate === false || validate === 'false') {
                    //     shellJS.exec(`SFDX_JSON_TO_STDOUT=true sfdx force:apex:test:run -s ${testsToRun} -c --json -r json --wait 20 --targetusername ${targetUserName}`, (status, stdout, stderr) => {
                    //         if (status === 0) {
                    //             logger.debug('Test Class run successful');
                    //             resolve('Deployment and Test Class run for CodeCoverage Successful');
                    //         } else {
                    //             logger.error('deploy.js: prepareAndCallMDDeployCommand: Deployment/Validation failed: error: ', stdout);
                    //             reject(stdout);
                    //         }
                    //     });
                    // } else {
                    //     resolve('Deployment Successful');
                    // }
                }
                if (status !== 0) {
                    logger.error('deploy.js: prepareAndCallMDDeployCommand: Deployment/Validation failed: error: ', stdout);
                    // Generate Error Notes as Artifacts
                    generateReleaseNotes(stdout, path.dirname(artifactPath), FAILURE);
                    logger.error('deploy.js: prepareAndCallMDDeployCommand: uri: ', uri);
                    if (uri) {
                        logger.error('About to send failure notification');
                        // Send Failure Notification to Slack
                        const codeCoverageResults = notify.calculateOverallCodeCoverage(JSON.parse(stdout), minCodeCoveragePerCmp);
                        notify.generateFailureNotificationForSlack(stdout, minCodeCoveragePerCmp, codeCoverageResults, validate, notificationTitle).then(message => notify.sendNotificationToSlack(uri, message))
                            .then((result) => {
                                reject(result);
                            })
                            .catch((error) => {
                                logger.error('$$error: ', error);
                                reject(error);
                            });
                    } else {
                        reject(new Error('Deployment Failed'));
                    }
                }
            });
        } catch (exception) {
            reject(exception);
        }
    });
}

const mdapiArtifactDeploy = (artifactPath, targetUserName,
    validate, testLevel, testsToRun, uri, minCodeCoverage,
    notificationTitle) => new Promise((resolve, reject) => {
    logger.debug('uri: ', uri);
    if (!fs.existsSync(artifactPath) && !fs.existsSync(`${artifactPath}.zip`)) {
        logger.debug(`Either there is nothing to be deployed or something went wrong with the package creation process, 
    please check the logs for package creation step.`);
        // process.exit(0);
        resolve('Either there is nothing to be deployed or something went wrong with the package creation process,please check the logs for package creation step.');
    }
    let runSpecifiedTests = false;
    if ((testLevel !== 'NoTestRun' && testLevel !== 'RunLocalTests' && testLevel !== 'RunAllTestsInOrg')
            && (fs.existsSync(`${artifactPath}/classes`) || testLevel === 'RunSpecifiedTests')) {
        runSpecifiedTests = true;
    }

    if (ZIPPED_ARTIFACT === true || (ZIPPED_ARTIFACT && ZIPPED_ARTIFACT.toLowerCase() === 'true')) {
        extract(`${artifactPath}.zip`,
            { dir: `${artifactPath}` },
            (err) => {
                if (err) {
                    logger.error(err);
                    reject(err);
                }
                // logger.debug('instanceUrl: ');
                logger.debug('list everything in the artifact created');
                shellJS.exec(`ls -a ${artifactPath}`);
                getTestsClasses(artifactPath)
                    .then((files) => {
                        /* --- Henry: CRITICAL THIS IS A SINGLE COMMA WITH NO SPACE. SPACE WILL BREAK IT ---*/
                        const allTests = [testsToRun, files].join(',');
                        logger.debug(allTests);
                        logger.debug('uri: ', uri);
                        return prepareAndCallMDDeployCommand(`${artifactPath}`,
                            targetUserName, validate, testLevel, allTests,
                            runSpecifiedTests, uri, minCodeCoverage, 75, notificationTitle);
                    })
                    .then((message) => {
                        logger.debug('message: ', message);
                        resolve(message);
                    })
                    .catch((error) => {
                        logger.error(error);
                        reject(error);
                    });
            });
    } else {
        logger.debug('No zipped artifact required.....');
        getTestsClasses(artifactPath)
            .then((files) => {
                /* --- Henry: CRITICAL THIS IS A SINGLE COMMA WITH NO SPACE. SPACE WILL BREAK IT ---*/
                const allTests = [testsToRun, files].join(',');
                logger.debug(allTests);
                logger.debug('uri: ', uri);
                return prepareAndCallMDDeployCommand(`${artifactPath}`,
                    targetUserName, validate, testLevel, allTests,
                    runSpecifiedTests, uri, minCodeCoverage, 75, notificationTitle);
            })
            .then((message) => {
                logger.debug('message: ', message);
                // TODO: Tag the current branch if it's tag based diff deployment
                resolve(message);
            })
            .catch((error) => {
                logger.error(error);
                reject(error);
            });
    }
});

const applyGitTag = (tagName, tagMessage) => new Promise((resolve, reject) => {
    // Tag the current branch and Commit-SHA
    const commitSHA = LATEST_COMMIT_HASH_TAG || 'HEAD';
    shellJS.exec(`git tag -a ${tagName} ${commitSHA} -m ${tagMessage} -f`, (code, stdout, stderr) => {
        logger.debug('code: ', code);
        // Push the tag
        if (stderr) {
            reject(stderr);
        }
        logger.debug('applyGitTag stdout: ', stdout);
        shellJS.exec(`git push origin ${tagName} -f`, (codeX, stdoutX, stderrX) => {
            logger.debug('applyGitTag: code: ', codeX);
            if (stderr) {
                reject(stderrX);
            } else {
                logger.debug('applyGitTag stdout', stdoutX);
                resolve(`${tagName} successfully appiled to ${commitSHA}`);
            }
        });
    });
});

const mdapiArtifactDeployWithDependencies = () => {

};

program
    .description('Set of commands to deploy/validate on Salesforce');

program
    .command('mdapipackage')
    .description('Deploys or validates an MDAPI artifact to the target Org.')
    .option('-p --artifactpath <path>', 'The location of the artifact to be deployed.')
    .option('-v --artifactversion <version>', 'Custom version identifier of the artifact.')
    .option('-u --username <username>', 'The username of the target Org.')
    .option('-t --envType <type>', 'The environment type of target Org. Either SANDBOX, PRODUCTION, DEVELOPER or SCRATCH.')
    .option('-s --password <secret>', 'The password for the target org appended with the security token.')
    .option('-a --targetUserName <tuname>', 'The username/alias for the target Org that is already authenticated via JWT.')
    .option('-c --validate <validate>', 'Specifies either artifact validation or deployment. If validate, no changes will be deployed to target Org.')
    .option('-g --gitTag <tag>', 'The tag name (annotated not lightweight) to be applied after a successful deployment.')
    .option('-l --testlevel <testLevel>', '(NoTestRun|RunSpecifiedTests|RunLocalTests|RunAllTestsInOrg) deployment testing level.')
    .option('-r --successSHA <sha>', 'The latest commit SHA to be stored in target Org Custom Setting.')
    .option('-m --minCodeCoverage <minCodeCoverage>', 'Minimum overall code coverage for the build')
    .option('-i --buildId <id>', 'Build-Id/Build-Number for uniquely identifying the deployment information.')
    .option('-n --uri <uri>', 'Slack notification Webhook URI.')
    .option('-k --testsLists <tests>', 'tests lists')
    .option('--notificationTitle <title>', 'Custom Notification Title for Slack')
    .option('-b --bypass <title>', 'Bypass Deployment Info Update with the latest commit SHA')
    .action((command) => {
        logger.debug(process.env);
        logger.info('command.artifactpath', command.artifactpath);
        logger.info('command.artifactversion', command.artifactversion);
        logger.info('command.targetusername', command.targetusername);
        logger.info('command.buildId', command.buildId);
        logger.debug('command.uri', command.uri);
        logger.debug('command.notificationTitle', command.notificationTitle);
        logger.debug('command.bypass', command.bypass);
        logger.debug('command.successSHA', command.successSHA);
        logger.debug('command.validate', command.validate);

        const username = command.username ? command.username : SF_USERNAME;
        const password = command.password ? command.password : SF_PASSWORD;
        const uri = command.uri ? command.uri : SLACK_NOTIFICATION_URI;
        const alias = command.targetUserName;
        const envType = command.envType ? command.envType : SF_ENV_TYPE;
        const minCodeCoverage = command.envType || MIN_OVERALL_CODE_COVERAGE || 75;
        const gitAnnotatedTag = command.gitTag ? command.gitTag : GIT_SUCCESS_TAG;

        if (!command.artifactpath) {
            logger.error('-p --artifactpath is a required param');
            process.exit(1);
        }

        let artifactPrefix;
        if (!command.artifactversion) {
            let oldCommit;
            const shaTag = command.successSHA || 'HEAD';
            const deploymentInfoPath = path.dirname(__dirname);
            logger.debug('deploymentInfoPath: ', deploymentInfoPath);
            logger.debug(`pathToStoreDeploymentInfoJSON: ${deploymentInfoPath}/deploymentInfo_${command.buildId}.json`);

            const shortSHA = gitUtils.getSHARevision(projectPath, shaTag);
            if (fs.existsSync(`${deploymentInfoPath}/deploymentInfo_${command.buildId}.json`)) {
                const deploymentInfoObject = fs.readJSONSync(`${deploymentInfoPath}/deploymentInfo_${command.buildId}.json`);
                oldCommit = deploymentInfoObject.Commit_SHA__c;
                artifactPrefix = `${oldCommit}-${shortSHA}`;
            } else {
                artifactPrefix = `start-${shortSHA}`;
            }
        }
        const artifactVersion = command.artifactversion || artifactPrefix.trim();
        const artifactName = `${MDAPI_PACKAGE_NAME}-${artifactVersion}`;
        logger.debug('artifactName: ', artifactName);

        if (!fs.existsSync(`${command.artifactpath}/${ARTIFACTS_DIR_NAME}/${artifactName}`)) {
            logger.debug(`The artifcat ${command.artifactpath}/${ARTIFACTS_DIR_NAME}/${artifactName} does not exists`);
            // Send notification
            notify.generateNoDiffMessage(command.notificationTitle).then(message => notify.sendNotificationToSlack(uri, message))
                .then((result) => {
                    logger.debug('result: ', result);
                    process.exit(0);
                })
                .catch((error) => {
                    logger.error(error);
                    process.exit(0);
                });
        }

        if (alias) {
            mdapiArtifactDeploy(`${command.artifactpath}/${ARTIFACTS_DIR_NAME}/${artifactName}`,
                alias, command.validate, command.testlevel, command.testsLists,
                uri, minCodeCoverage, command.notificationTitle)
                .then((message) => {
                    logger.info('Updating the deployment Info in the target org');
                    logger.debug(message);
                    if (command.successSHA && command.validate !== true
                        && command.bypass !== true
                        && (!command.validate || 
                            (command.validate && command.validate.toLowerCase() !== 'true'))
                        &&  (!command.bypass || 
                                (command.bypass && command.bypass.toLowerCase() !== 'true'))) {
                        logger.info('Updating the deployment Info in the target org, as it is not a validation');
                        // Find the git short hash revision
                        const shortSHA = gitUtils.getSHARevision(projectPath, command.successSHA);
                        logger.debug('shortSHA: ', shortSHA);
                        // the module name logic will be refined to support modular deployment
                        logger.debug('alias: ', alias);
                        return deploymentInfoService.updateDeploymentInfo('All', shortSHA, 'DEPLOYED', null, alias);
                    } else {
                        logger.info('Not Updating the deployment Info in the target org, as it is a validation');
                        return message;
                    }
                })
            // .then(() => applyGitTag(gitAnnotatedTag, 'Success Message for annotated tag'))
                .then((message) => {
                    logger.debug(message);
                    process.exit(0);
                })
                .catch((error) => {
                    logger.error(error);
                    process.exit(1);
                });
        } else if (username && password) {
            let con;
            if (!envType) {
                logger.error('-t --envType is required with username-password based deployment');
                process.exit(1);
            }
            logger.debug('username/password is passed which means credentials based authentication to be used');
            authenticate.loginWithCreds(username, password, envType)
                .then((connection) => {
                    con = connection;
                    // eslint-disable-next-line max-len
                    // set the url configuration, required in case of running sfdx commands with access token
                    shellJS.exec(`sfdx force:config:set instanceUrl=${connection.instanceURL} --global`);
                    return mdapiArtifactDeploy(`${command.artifactpath}/${ARTIFACTS_DIR_NAME}/${artifactName}`,
                        connection.accessToken, command.validate, command.testlevel,
                        command.testsLists, uri, minCodeCoverage, command.notificationTitle);
                })
                .then((message) => {
                    logger.info('Updating the deployment Info in the target org');
                    logger.info('command.successSHA: ', command.successSHA);
                    logger.info('command.validate: ', command.validate);
                    logger.debug(message);
                    if (command.successSHA && command.validate !== true
                        && command.bypass !== true
                        && (!command.validate || 
                         (command.validate && command.validate.toLowerCase() !== 'true'))
                        &&  (!command.bypass || 
                            (command.bypass && command.bypass.toLowerCase() !== 'true'))) {
                        logger.info('Updating the deployment Info in the target org, as it is not a validation');
                        // Find the git short hash revision
                        const shortSHA = gitUtils.getSHARevision(projectPath, command.successSHA);
                        logger.debug('shortSHA: ', shortSHA);
                        // the module name logic will be refined to support modular deployment
                        return deploymentInfoService.updateDeploymentInfo('All', shortSHA, 'DEPLOYED', con);
                    } else {
                        logger.info('Not Updating the deployment Info in the target org, as it is a validation');
                        return message;
                    }
                })
                // .then(() => applyGitTag(gitAnnotatedTag, 'Success Message for annotated tag'))
                .then((message) => {
                    logger.debug(message);
                    process.exit(0);
                })
                .catch((error) => {
                    logger.error(error);
                    process.exit(1);
                });
        } else {
            logger.error('Something went wrong, username/password incorrect or one of them is not passed');
            process.exit(1);
        }
    });

program.parse(process.argv);

// Export methods
module.exports = {
    srcArtifactDeployOneByOne,
    mdapiArtifactDeploy,
    mdapiArtifactDeployWithDependencies,
};

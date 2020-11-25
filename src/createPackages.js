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

const program = require('commander');

const path = require('path');
const fs = require('fs-extra');
const shellJS = require('shelljs');

const artifactCreator = require('./packageCreationService');
const secondGenPackaging = require('./services/secondGenPackagingService');
const gitDiff = require('./gitDiff');
const logger = require('./utils/logger');
const notify = require('./utils/notificationsUtil');

const MULTI_PACKAGE_NAME = process.env.MDAPI_PACKAGE_GROUP_NAME ? process.env.MDAPI_PACKAGE_GROUP_NAME : 'metadatapackage-group';
const MDAPI_PACKAGE_NAME = process.env.MDAPI_PACKAGE_NAME ? process.env.MDAPI_PACKAGE_NAME : 'mdapiPackage';
const SLACK_WEBHOOK_URL = process.env.SLACK_NOTIFICATION_URI ? process.env.SLACK_NOTIFICATION_URI : null;


// Variable to hold the location of the project for which deployable
// metadata packages would be created or from where source
// based modular deployments take place
let projectPath = process.env.PROJECT_PATH || '.';
let projectLocation = projectPath;
logger.debug(`Code is executing in ${__dirname} directory`);
const diffProjectPath = path.join(path.dirname(__dirname), '/DiffProject');
logger.debug(`Location to store diff files, diffProjectPath: ${diffProjectPath}`);

const promiseMethod = message => new Promise((resolve) => {
    resolve(message);
});

const createPackage = (command, type, artifactCreationMethod) => {
    let { oldCommit } = command;
    const { newCommit } = command;
    if (!command.artifactsLocation) {
        logger.error('-p --artifactsLocation is a required param');
        process.exit(1);
    }
    if (command.projectLocation) {
        projectPath = command.projectLocation;
        projectLocation = command.projectLocation;
    }
    logger.debug(`${type}: `, command);
    const artifactsLocation = path.join(command.artifactsLocation, '/Artifacts');
    logger.debug(`${type}: Location to store artifacts, artifactsLocation: ${artifactsLocation}`);
    logger.debug(`${type}: command.newCommit: `, command.newCommit);
    logger.debug(`${type}: command.oldCommit: `, command.oldCommit);

    // If it is not a full deployment, then only check for deploymentInfo
    // in the target org to get the previous commit
    if (!oldCommit && newCommit) {
        logger.debug(`${type}: commit to compare to be pulled from the org`);
        const deploymentInfoPath = path.dirname(__dirname);
        logger.debug(`${type}: deploymentInfo.json path with name of the file : ${deploymentInfoPath}/deploymentInfo_${command.buildId}.json`);
        if (fs.existsSync(`${deploymentInfoPath}/deploymentInfo_${command.buildId}.json`)) {
            const deploymentInfoObject = fs.readJSONSync(`${deploymentInfoPath}/deploymentInfo_${command.buildId}.json`);
            oldCommit = deploymentInfoObject.Commit_SHA__c;
            logger.debug(`${type}: oldCommit: `, oldCommit);
        }
    }

    // prepare the package version based on old and new CommitSHAs
    logger.debug(`${type}:  Before createPackageVersion: `);
    const packageVersion = artifactCreator.createPackageVersions(command.packageVersion, oldCommit,
        newCommit, projectLocation);
    logger.debug(`${type}:  packageVersion: `, packageVersion);

    // Create package only if it does not exists
    let packageNameWithoutVersion = MULTI_PACKAGE_NAME;
    packageNameWithoutVersion = type === 'source-combined' || type === 'mdapi' ? MDAPI_PACKAGE_NAME : MULTI_PACKAGE_NAME;
    if (fs.existsSync(`${artifactsLocation}/${packageNameWithoutVersion}-${packageVersion}`)) {
    // Do nothing
        logger.debug(`${packageNameWithoutVersion}-${packageVersion} Package exists`);
    } else if ((!newCommit && !oldCommit)
    || (newCommit && !command.packageVersion && !oldCommit)
        || command.full === 'true'
        || command.full === true) {
        // Both the old and new commit params if not passed
        // Or new commit is passed but there is no package version being passed and old commit is
        // not passed, this basically  signifies the command is expecting the diff based on commit SHA
        // stored in the target Org
        // Or Full flag if passed as true
        // Any of these indicates for a full package creation
        logger.debug(`${type}: Full Package creation`);
        logger.debug(`${type}: createMultipleArtifacts will be called in next line`);

        promiseMethod(`${type}`)
            .then((message) => {
                logger.debug(`${message} is being processed`);
                if (type === 'source-multi' || type === 'source-combined') {
                    return artifactCreationMethod(projectLocation, artifactsLocation, packageVersion);
                }

                return artifactCreationMethod(projectLocation, artifactsLocation, packageVersion, false);
            })
            .then((message) => {
                logger.debug(`${type}: createMultipleArtifacts: `, message);
                process.exit(0);
            })
            .catch((error) => {
                logger.error(`${type}: `, error);
                notify.sendNotificationToSlack(SLACK_WEBHOOK_URL, error.message);
                process.exit(1);
            });
    } else {
        logger.debug(`${type}: Diff Package creation`);
        projectLocation = diffProjectPath;
        logger.debug(`${type}: diffProjectPath: `, diffProjectPath);
        logger.debug(`${type}: prepareDiffProject will be called in next line`);
        logger.debug(`${type}: `, oldCommit);
        let sourceFormat = false;
        sourceFormat = type === 'source-multi' || type === 'source-combined';
        gitDiff.prepareDiffProject(projectPath,
            diffProjectPath, command.newCommit, oldCommit, sourceFormat, artifactsLocation)
            .then((message) => {
                const doGitDiff = true;
                logger.debug(`${type}: `, message);
                if (type === 'source-multi' || type === 'source-combined') {
                    logger.debug(`${type}: createMultipleArtifacts will be called in next line`);
                    return artifactCreationMethod(
                        projectLocation, artifactsLocation, packageVersion,
                    );
                }
                logger.debug(`${type}: createMDAPIPackageArtifact will be called in next line`);
                return artifactCreationMethod(
                    projectLocation, artifactsLocation, packageVersion, doGitDiff,
                );
            })
            .then((message) => {
                logger.debug(`${type}: `, message);
                process.exit(0);
            })
            .catch((error) => {
                logger.error(`${type}: `, error);
                notify.sendNotificationToSlack(SLACK_WEBHOOK_URL, error.message);
                process.exit(1);
            });
    }
};

// Various Command Definitions and Actions for Artifacts/Packages creation
program
    .description('Set of commands to create different type of artifacts/packages');

// Multiple/Multi-Module Artifacts/Packages creation for a SFDX Repo/Directory
program
    .command('source-multi')
    .description('Creates deployable MDAPI artifacts for each module in a multi-module SFDX repository.')
    .option('-v --packageVersion <version>', 'Custom version identifier of an artifact')
    .option('-n --newCommit [nc]', 'Latest commit-sha or git tag used for diff comparison.')
    .option('-o --oldCommit [oc]', 'Older commit-sha or git tag used for diff comparison.')
    .option('-p --artifactsLocation <aLocation>', 'The path for storing generated artifacts.')
    .option('-l --projectLocation <pLocation>', 'The path of the project or repository.')
    .option('-i --buildId <id>', 'Build-Id/Build-Number for uniquely identifying the deployment information.')
    .action((command) => {
        createPackage(command, 'source-multi', artifactCreator.createMultipleArtifacts);
    });

// Combined/Single Artifacts/Packages creation for a SFDX Repo/Directory
program
    .command('source-combined')
    .description('Creates a single deployable MDAPI artifact from a multi-module SFDX repository.')
    .option('-v, --packageVersion <version>', 'Custom version identifier of an artifact')
    .option('-n, --newCommit [nc]', 'Latest commit-sha or git tag used for diff comparison.')
    .option('-o, --oldCommit [oc]', 'Older commit-sha or git tag used for diff comparison.')
    .option('-p --artifactsLocation <aLocation>', 'The path for storing generated artifacts.')
    .option('-l --projectLocation <pLocation>', 'The path of the project or repository.')
    .option('-i --buildId <id>', 'Build-Id/Build-Number for uniquely identifying the deployment information.')
    .option('-f --full <full>', 'This flag will override everything and go for a full deployment')
    .action((command) => {
        createPackage(command, 'source-combined', artifactCreator.createCombinedArtifact);
    });

// Artifact/Package Creation for a Non-SFDX Repo/Directory
program
    .command('mdapi')
    .description('Creates a single deployable artifact from non-SFDX format repository.')
    .option('-v, --packageVersion <version>', 'Custom version identifier of an artifact')
    .option('-n, --newCommit [nc]', 'Latest commit-sha or git tag used for diff comparison.')
    .option('-o, --oldCommit [oc]', 'Older commit-sha or git tag used for diff comparison.')
    .option('-p --artifactsLocation <aLocation>', 'The path for storing generated artifacts.')
    .option('-l --projectLocation <pLocation>', 'The path of the project or repository.')
    .option('-i --buildId <id>', 'Build-Id/Build-Number for uniquely identifying the deployment information.')
    .option('-f --full <full>', 'This flag will override everything and go for a full deployment')
    .action((command) => {
        createPackage(command, 'mdapi', artifactCreator.createMDAPIPackageArtifact);
    });

program
    .command('second-gen-version')
    .description('Create a second generation package version')
    // .option('-a --versionname <name>', 'the name of the package version to be created')
    .option('-b --branch <branch>', 'the package version’s branch')
    .option('-c --codecoverage <coverage>', ' calculate the code coverage by running the packaged Apex tests.')
    .option('-d --path <path>', ' path to directory that contains the contents of the package')
    // .option('-e --versiondescription <description>', 'the description of the package version to be created')
    // .option('-f --definitionfile <file>', 'path to a definition file similar to scratch org definition file that contains the list of features and org \n' +
// '                                                   preferences that the metadata of the package version depends on')
    .option('-k --installationkey <key>', 'installation key for key-protected package (either --installationkey or --installationkeybypass is required)')
    .option('-n --versionnumber <vnumber>', 'the version number of the package version to be created')
    .option('-p --package <package>', 'ID (starts with 0Ho) or alias of the package to create a version of')
    // .option('-t --tag <tag>', 'the package version’s tag')
    .option('-v --targetdevhubusername <username>', 'username or alias for the dev hub org; overrides default dev hub org')
    .option('-s --targetdevhubpassword <password>', 'password for the dev hub org')
    .option('-t --tag <tag>', 'the package version’s tag')
    .option('-x --installationkeybypass <keybypass>', 'bypass the installation key requirement (either --installationkey or --installationkeybypass is required)\n')
    .option('--workingDirectory <workingdir>', 'working directory of the build service')
    .action((command) => {
        logger.debug('command: ', command);
        logger.debug('workingDirectory: ', command.workingDirectory);
        shellJS.exec('pwd');
        // shellJS.exec(`cd ${command.workingDirectory}`);
        // shellJS.exec('pwd');
        secondGenPackaging.createPackageVersion(command)
            .then((result) => {
                logger.debug('Versioning Successful, now looking for the report for codecoverage');
                logger.debug('result: ', result);
                return secondGenPackaging.getVersionReport(result);
            })
            .then((report) => {
                logger.debug('Version Reporting Successful');
                logger.debug('report: ', report);
                return secondGenPackaging.handlePackageCodeCoverage(report, command.codecoverage);
            })
            .then((successMessage) => {
                logger.debug('Code Coverage Successful');
                logger.debug('successMessage: ', successMessage);
                secondGenPackaging.generateSuccessfulPackageCreationMessage(successMessage)
                    .then(message => notify.sendNotificationToSlack(SLACK_WEBHOOK_URL, message))
                    .then((message) => {
                        logger.debug(message);
                        process.exit(0);
                    })
                    .catch((err) => {
                        logger.error(err);
                        process.exit(0);
                    });
            })
            .catch((error) => {
                logger.error(error);
                secondGenPackaging.generatePackageCreationFailureMessage(error)
                    .then(message => notify.sendNotificationToSlack(SLACK_WEBHOOK_URL, message))
                    .then((message) => {
                        logger.debug(message);
                        process.exit(1);
                    })
                    .catch((err) => {
                        logger.error(err);
                        process.exit(1);
                    });
            });
    });


program.parse(process.argv);

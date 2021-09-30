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
const shellJS = require('shelljs');
const fs = require('fs-extra');
const promisify = require('util').promisify;
const extract = require('extract-zip');
const path = require('path');
const tableify = require('tableify');
const xml2js = require('xml2js');

const promisfiedExtract = promisify(extract);


const deploymentInfoService = require('../services/deploymentInfoService');
const gitUtils = require('../utils/gitUtils');
const notify = require('../utils/notificationsUtil');
const logger = require('../utils/logger');
const resultsTransformer = require('../services/deploymentResultsTransformer');
const { resolve } = require('path');


const FAILURE = 'Failure';
const SUCCESS = 'Success';
const NO_CODE_COVERAGE_INFO = 'No Code Coverage Info';
const WAIT_TIME = process.env.WAIT_TIME || -1;
const ENABLE_INDIVIDUAL_TESTS_COVERAGE  = process.env.ENABLE_INDIVIDUAL_TESTS_COVERAGE || true;
const DEPLOYMENT_RESPONSE_NO_ARTIFACT = 'Either there is nothing to be deployed or something went wrong with the package creation process,please check the logs for package creation step.';

const {
    ZIPPED_ARTIFACT,
    LATEST_COMMIT_HASH_TAG,
} = process.env;

const generateReleaseNotes = (jsonObject, locationToStore, type) => {
    // const jsonObject = JSON.parse(jsonString);
    //Project Root Directory
    const ROOT_DIR = process.env.PWD;
    const PROJECT_ROOT_DIR = '/usr/gs_alm' // TODO: To be moved to environment variable or Repo Variables
    const NODE_WORKING_DIRECTORY = __dirname
    logger.debug('Root Directory: ', ROOT_DIR)
    logger.debug('NODE Working Directory: ', NODE_WORKING_DIRECTORY);
    logger.debug('Parent Directory For Working Directory: ', path.dirname(NODE_WORKING_DIRECTORY));
    logger.debug('locationToStore: ', locationToStore);

    // const cssFilePath = path.join(path.dirname(__dirname), 'styles', 'tableify.css');
    const cssFilePath = path.join(PROJECT_ROOT_DIR, 'styles', 'tableify.css');
    logger.debug('cssFilePath ', cssFilePath);
    const css = fs.readFileSync(cssFilePath);
    const html = `<html><style>${css}</style>${tableify(jsonObject)}</html>`;
    const epochTime = Math.floor(new Date() / 1000);
    const filePathForHTML = path.join(locationToStore, `deploymentResults_${type}_${epochTime}.html`);
    const filePathForJSON = path.join(locationToStore, `deploymentResults_${type}_${epochTime}.json`);
    logger.debug('filePathForHTML: ', filePathForHTML);
    logger.debug('filePathForJSON: ', filePathForJSON);
    fs.writeFileSync(filePathForHTML, html);
    fs.writeFileSync(filePathForJSON, JSON.stringify(jsonObject));
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
                        resolve(testClasses);
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
function srcArtifactDeployOneByOne(srcProjectPath, targetUserName, dependenciesFilePath) {

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
            resolve('Successful.....');
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
 * @param minCodeCoveragePerCmp
 * @param notificationTitle
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


            shellJS.exec(command, {silent: true}, (status, stdout, stderr) => {
                logger.debug('status: ', status);
                logger.debug('stdout: ', stdout);
                resultsJSObject = JSON.parse(stdout);
                if(status !== 0) {
                    if(resultsJSObject.name.includes('PathDoesNotExist') ) {
                        logger.info('Package/Artifact does not exists and release notes can not be generated');
                    } else {
                        logger.debug('deploy.js: prepareAndCallMDDeployCommand: Deployment/Validation failed: error: ', resultsJSObject);
                        // Generate Error Notes as Artifacts
                        console.log(resultsTransformer.transformAndBeautifyFailureResults(resultsJSObject));
                        generateReleaseNotes(resultsJSObject, path.dirname(artifactPath), FAILURE);
                        logger.error('deploy.js: prepareAndCallMDDeployCommand: uri: ', uri);
                    }
                }
                else  {
                    // Generate Success Release Notes as Artifacts
                    generateReleaseNotes(resultsJSObject, path.dirname(artifactPath), SUCCESS);
                }
                resolve(stdout);
            });


        } catch (exception) {
            reject(exception);
        }
    });
}



const mdapiArtifactDeploy = (artifactPath, targetUserName, validate, testLevel, testsToRun, uri, minCodeCoverage, notificationTitle) => {
    return new Promise((resolve, reject) => {
        // TODO: All this should be moved to async-await pattern
        try {
            if (!fs.existsSync(artifactPath) && !fs.existsSync(`${artifactPath}.zip`)) {
                logger.debug(DEPLOYMENT_RESPONSE_NO_ARTIFACT);
                // process.exit(0);
                //return new Promise((resolve, reject) => {
                resolve(DEPLOYMENT_RESPONSE_NO_ARTIFACT);
                //});   
            }
    
            let runSpecifiedTests = false;
    
            if ((testLevel !== 'NoTestRun' && testLevel !== 'RunLocalTests' && testLevel !== 'RunAllTestsInOrg')
            && (fs.existsSync(`${artifactPath}/classes`) || testLevel === 'RunSpecifiedTests')) {
                runSpecifiedTests = true;
            }
            logger.debug('Debugging after testLevel check');
            logger.debug('ZIPPED_ARTIFACT :', ZIPPED_ARTIFACT);
            if (ZIPPED_ARTIFACT === true || (ZIPPED_ARTIFACT && ZIPPED_ARTIFACT.toLowerCase() === 'true')) {
                logger.debug('Zipped artifact is required: ', ZIPPED_ARTIFACT);
                logger.debug('artifactPath', artifactPath);
                promisfiedExtract(`${artifactPath}.zip`, { dir: `${artifactPath}` })
                .then(result => {
                    logger.debug('list everything in the artifact created');
                    shellJS.exec(`ls -a ${artifactPath}`);
                    return deploy.setTestsAndDeploy( artifactPath,
                                            targetUserName,
                                            validate,
                                            testLevel,
                                            testsToRun,
                                            runSpecifiedTests,
                                            uri,
                                            notificationTitle);
                })
                .then(result => {
                    logger.debug(result);
                    resolve(result);
                })
                .catch(err => {
                    logger.error(err);
                    reject(err);
                });
                // return new Promise((resolve, reject) => {
                //     extract(`${artifactPath}.zip`,
                //    { dir: `${artifactPath}` },
                //    (err) => {
                //        if (err) {
                //             logger.error(err);
                //             //return new Promise((resolve, reject) => {
                //             reject(err);
                //             //});
                //        }
                //        logger.debug('list everything in the artifact created');
                //        shellJS.exec(`ls -a ${artifactPath}`);
                //        return deploy.setTestsAndDeploy( artifactPath,
                //                                targetUserName,
                //                                validate,
                //                                testLevel,
                //                                testsToRun,
                //                                runSpecifiedTests,
                //                                uri,
                //                                notificationTitle);
                //    });
                // });
                
            } else {
                logger.debug('No zipped artifact required.....');
                deploy.setTestsAndDeploy( artifactPath,
                                        targetUserName,
                                        validate,
                                        testLevel,
                                        testsToRun,
                                        runSpecifiedTests,
                                        uri,
                                        notificationTitle)
                .then(result => {
                    logger.debug(result);
                    resolve(result)
                })
                .catch(err => {
                    logger.error(err);
                    reject(err);
                });
            }
            logger.debug('After zipped folder required condition check');
        } catch(err) {
            logger.error(err);
            reject(err);
            // return new Promise((resolve, reject) => {
            //     logger.error(err);
            //     reject(err);
            // });
        }
    })
    
    
 }


/**
 * @description : Runs the deployment
 * @author      : Groundswell Cloud Solutions
 *
 */
const deploy = {

    /*========================================================
    Description :
    ==========================================================*/
    setTestsAndDeploy : function( artifactPath, targetUserName, validate, testLevel, testsToRun, runSpecifiedTests, uri, notificationTitle){
        const   minBuildCoverage = 75,
                minCodeCoveragePerCmp = 75;

        let res = null;

        return new Promise((resolve,reject)=>{
            getTestsClasses(artifactPath)
            .then( files => {
                /* --- Henry: CRITICAL THIS IS A SINGLE COMMA WITH NO SPACE. SPACE WILL BREAK IT ---*/
                let testsToRunList = [];
                if(testsToRun) {
                    testsToRunList = testsToRun.split(',');
                }
                const  allTests = [...testsToRunList, ...files].join(',');

                logger.debug(allTests);
                logger.debug('uri: ', uri);

                // Deploys the Artifacts To Org
                return prepareAndCallMDDeployCommand( artifactPath,
                                                    targetUserName,
                                                    validate,
                                                    testLevel,
                                                    allTests,
                                                    runSpecifiedTests,
                                                    uri,
                                                    minBuildCoverage,
                                                    minCodeCoveragePerCmp,
                                                    notificationTitle );

            })
            .then( response => {
                res = response;
                let deploymentRes = JSON.parse(response);

                return (deploymentRes.status === 0)
                    ? this.success( deploymentRes, uri, validate, minBuildCoverage, minCodeCoveragePerCmp, notificationTitle, resolve )
                    : this.failed( deploymentRes, uri, minBuildCoverage, minCodeCoveragePerCmp, validate, notificationTitle, reject );
            })
            .then( result => {
                logger.debug(result);
                resolve(res); // returning the deployment response back
            })
            .catch( error => {
                logger.error(error);
                reject(error);
            });

        });
    },

    /*========================================================
    Description : On Successful Deployment
    ==========================================================*/
    success  :  function(response, uri, validate, minBuildCoverage, minCodeCoveragePerCmp, notificationTitle) {
        
        
        // If URI not defined, return the sucessful deployment message so that
        // the calling code can exit
        if (!uri) { 
            return new Promise((resolve, reject) => {
                resolve ('Deployment Successful'); 
            });
        }
        else {
            // Send Success Notification to Slack
            logger.debug('About to send notification');

            // Get Code Coverage for the build
            const codeCoverageResults = notify.calculateOverallCodeCoverage( response, parseInt(minCodeCoveragePerCmp));

            logger.debug('Minimum Build Coverage: ', parseInt(minBuildCoverage));
            logger.debug('codeCoverageResults.cmpsWithLessCodeCoverage.length: ', codeCoverageResults?.cmpsWithLessCodeCoverage?.length);

            // Sufficient Code Coverage
            // Send Success Notifications to Slack
            return this.isSufficientCoverage(codeCoverageResults, minBuildCoverage)
                ? notification.success( uri, codeCoverageResults, validate, notificationTitle)
                : notification.failed(response, uri, minCodeCoveragePerCmp, codeCoverageResults, validate, notificationTitle);
        }
        
        
    },

    /*========================================================
    Description : On Failed Deployment
    ==========================================================*/
    failed : function(response, uri, validate, minBuildCoverage, minCodeCoveragePerCmp, notificationTitle){
        
        // If URI not defined, return the sucessful deployment message so that
        // the calling code can exit
        if (!uri) { 
            return new Promise((resolve, reject) => {
                reject(new Error('Deployment Failed')); 
            });
            
        }
        else {
            logger.error('About to send failure notification');

            // Send Failure Notification to Slack
            const codeCoverageResults = notify.calculateOverallCodeCoverage( response, minCodeCoveragePerCmp );
            return notification.failed(response, uri, minCodeCoveragePerCmp, codeCoverageResults, validate, notificationTitle);
        }
    },

    /*========================================================
    Description :
    ==========================================================*/
    isSufficientCoverage :  function(codeCoverageResults, minBuildCoverage){
        let coverageResults = codeCoverageResults === NO_CODE_COVERAGE_INFO || codeCoverageResults.overallBuildCodeCoverage > parseInt(minBuildCoverage);
        if(ENABLE_INDIVIDUAL_TESTS_COVERAGE === 'true' || ENABLE_INDIVIDUAL_TESTS_COVERAGE === true) {
            const length = codeCoverageResults?.cmpsWithLessCodeCoverage?.length;
            logger.debug('codeCoverageResults.cmpsWithLessCodeCoverage.length: ',length);
            if(length) {
                coverageResults = coverageResults && length <= 0;
            }
            
        }
        return coverageResults;
    }
}




/**
 * @description : Notification for deployment
 * @author      : Groundswell Cloud Solutions
 *
 */
const notification = {

    /*========================================================
    Description : Successful Deployment Notification
    ==========================================================*/
    success : function( uri, codeCoverageResults, validate, notificationTitle){
        return new Promise((resolve,reject)=>{
            notify.generateSuccessNotificationForSlack(codeCoverageResults, validate, notificationTitle)
            .then(message => notify.sendNotificationToSlack(uri, message))
            .then((result) => {
                resolve(result);
            })
            .catch((error) => {
                logger.error('$$error: ', error);
                resolve('Error is there');
            });
        })
    },

    /*========================================================
    Description : Failed Deployment Notification
    ==========================================================*/
    failed : function( response, uri, minCodeCoveragePerCmp, codeCoverageResults, validate, notificationTitle ){
        return new Promise((resolve,reject)=>{
            notify.generateFailureNotificationForSlack(response, minCodeCoveragePerCmp, codeCoverageResults, validate, notificationTitle)
            .then(message => notify.sendNotificationToSlack(uri, message))
            .then((result) => {
                reject(result);
            })
            .catch((error) => {
                logger.error('$$error: ', error);
                reject(error);
            });
        })
    }
}


const quickDeployUsingId = function(deploymentId, uri, targetUserName, notificationTitle){
    let res = null;
    return new Promise((resolve, reject) => {
        new Promise((resolve, reject) => {
            let command = `SFDX_JSON_TO_STDOUT=true sfdx force:mdapi:deploy --validateddeployrequestid ${deploymentId} --json --wait ${WAIT_TIME} --verbose --targetusername ${targetUserName}`;
            logger.debug('command: ', command);
            shellJS.exec(command, (status, stdout, stderr) => {
                logger.debug('status: ', status);
                resolve(stdout);
            });
        })
        .then( response => {
            res = response;
            let deploymentRes = JSON.parse(response);
            logger.debug('THIS IS THE CHECK :::: ',deploymentRes);
            resolve(res);
            // No need to send notification here
            // return (deploymentRes.status === 0)
            //   ? notification.success( uri, `${NO_CODE_COVERAGE_INFO}`, false, notificationTitle)
            //   : notification.failed( res, uri, 100, `${NO_CODE_COVERAGE_INFO}`, false, notificationTitle);
        })
        // .then( result => {
        //     resolve(res);
        // })
        .catch( error => {
            logger.error(error);
            process.exit(1);
        });
    });
}



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



/**
 * @description      : Artifact processing object
 * Author            : Groundswell Cloud Solutions
 */
const artifactProcessor = {

    name    : null, // artifact name
    version : null, // artifact version

    /* ===================================
    Description : To check artifact path and it it doesn't exist stops the process
    ====================================== */
    checkPath : function(command){
        if (command.artifactpath) { return this; }
        logger.error('-p --artifactpath is a required param');
        process.exit(1);
    },

    /*====================================
    Description :  Set artifact version
    ======================================*/
    setVersion : function(command, projectPath){
        // no further check needed
        this.version= command.artifactversion
                    ? command.artifactversion
                    : (()=>{

                        const shaTag = command.successSHA || 'HEAD';
                        const shortSHA = gitUtils.getSHARevision(projectPath, shaTag);

                        const deploymentInfoObject = deploymentInfoService.getObject(command);
                        const oldCommit = deploymentInfoObject ? deploymentInfoObject.Commit_SHA__c : null;

                        let prefix = oldCommit ? `${oldCommit}-${shortSHA}` : `start-${shortSHA}`;
                        return prefix.trim();

                    })();

        return this;
    },

    /*====================================
    Description :  Set artifact name
    ======================================*/
    setName : function(mdapiPackagePrefix){
        this.name = `${mdapiPackagePrefix}-${this.version}`;
        logger.debug('artifactName: ', this.name);
        return this;
    },

    /*============================================
    Description :  Check If Artifact Exists
    ==============================================*/
    exists : function(command, DIRECTORY, uri){
        if (fs.existsSync(`${command.artifactpath}/${DIRECTORY}/${this.name}`)) { return this; }
        logger.debug(`The artifact ${command.artifactpath}/${DIRECTORY}/${this.name} does not exists`);

        /* Send notification */
        notify.generateNoDiffMessage(command.notificationTitle)
        .then(message => notify.sendNotificationToSlack(uri, message))
        .then((result) => {
            logger.debug('result: ', result);
            process.exit(0);
        })
        .catch((error) => {
            logger.error(error);
            process.exit(0);
        });
    }
};

/**
 * @description      : Deployment processing object
 * @author           : Groundswell Cloud Solutions
 */
const deploymentProcessor = {

    /*===============================================
    Description : Run the deployment
    =================================================*/
    mdapiDeploy : function(command, constants, artifact, aliasOrConnection, type, DIRECTORY, projectPath){
        return new Promise((resolve, reject) => {
            logger.debug('command: ', command);
            logger.debug('constants: ', constants);
            logger.debug('artifact: ', artifact);
            logger.debug('aliasOrConnection: ', type);
            logger.debug('DIRECTORY: ', DIRECTORY);
            logger.debug('DIRECTORY: ', projectPath);
            logger.debug('Next we are going to call mdapiArtifactDeploy function');
            if(!artifact) {
                resolve('No artifact to deploy');
            } else {
                mdapiArtifactDeploy(`${command.artifactpath}/${DIRECTORY}/${artifact.name}`,
                type=='alias' ? aliasOrConnection : aliasOrConnection.accessToken,
                command.validate,
                command.testlevel,
                command.testsLists,
                constants.uri,
                constants.minCodeCoverage,
                command.notificationTitle)
                .then( res =>{
                    return type=='alias'
                        ? this.updateDeployInfo(command, res, aliasOrConnection, null, projectPath)
                        : this.updateDeployInfo(command, res, null, aliasOrConnection, projectPath);
                })
                .then( message =>{
                    logger.debug('Message :: ',message);
                    resolve(message);
                })
                .catch( err => {
                    logger.debug('Error :: ',err);
                    reject(err);
                })
            }
            
        });

    },

    /*===============================================
    Description : Update the deployment info record
    =================================================*/
    updateDeployInfo : function(command, deploymentRes, alias, connection, projectPath){

        logger.info('Updating the deployment Info in the target org');
        logger.info('command.successSHA: ', command.successSHA);
        logger.info('command.validate: ', command.validate);
        logger.trace('deploymentRes :: ', deploymentRes);
        let shortSHA;
        if(deploymentRes === DEPLOYMENT_RESPONSE_NO_ARTIFACT) {
            logger.info('Not Updating the deployment Info in the target org, as there is nothing deployed');
            return new Promise((resolve, reject)=>{ resolve(deploymentRes); });
        }
        if (command.successSHA && this.isNotBypass(command) && this.isNotValidation(command)){
            logger.info('Updating the deployment Info in the target org, as it is not a validation');
            // Find the git short hash revision
            shortSHA = gitUtils.getSHARevision(projectPath, command.successSHA);
            logger.debug('shortSHA: ', shortSHA);
            // the module name logic will be refined to support modular deployment
            const gitTag = 'DEPLOYED';
            return alias
            ? deploymentInfoService.updateDeploymentInfo(command.module, shortSHA, gitTag, null, alias, deploymentRes)
            : deploymentInfoService.updateDeploymentInfo(command.module, shortSHA, gitTag, connection, null, deploymentRes);

        } else if(!this.isNotValidation(command)){
            // Update the Deployment Info with the deployment id, without updating the SHA
            const gitTag = 'VALIDATED';
            return alias
            ? deploymentInfoService.updateDeploymentInfo(command.module, shortSHA, gitTag, null, alias, deploymentRes)
            : deploymentInfoService.updateDeploymentInfo(command.module, shortSHA, gitTag, connection, null, deploymentRes);
        }
        else {
            logger.info('Not Updating the deployment Info in the target org, as it is a bypass');
            return new Promise((resolve, reject)=>{ resolve(deploymentRes); });
        }
    },

    /*===============================================
    Description : To check for bypass flag
    =================================================*/
    isNotBypass : function(command){
        return command.bypass !== true
            && (!command.bypass || (command.bypass && command.bypass.toLowerCase() !== 'true'));
    },

    /*===============================================
    Description : To check for validation flag
    =================================================*/
    isNotValidation : function(command){
        return command.validate !== true
            && (!command.validate || (command.validate && command.validate.toLowerCase() !== 'true'));
    },

    /*==========================================================
    Description : Quick Deployment for already validated package
    ============================================================*/
    quickDeploy : function(command, constants, artifact, aliasOrConnection, type, DIRECTORY, projectPath){
        const deploymentInfoObject = deploymentInfoService.getObject(command);
        if(!deploymentInfoObject || deploymentInfoObject.Deployment_Id__c == null){
            logger.error('Invalid deployment Id in Deployment Info!');
            process.exit(1);
        }

        quickDeployUsingId(  deploymentInfoObject.Deployment_Id__c,
                                        constants.uri,
                                        type=='alias' ? aliasOrConnection : aliasOrConnection.accessToken,
                                        command.notificationTitle )
        .then( async response => {
            logger.debug('QUICK DEPLOYMENT RESPONSE CHECK :::', response );
            if(response.status === 0) {
                // Update the deployment info and send the notification
                type=='alias'
                ? await this.updateDeployInfo(command, response, aliasOrConnection, null, projectPath)
                : await this.updateDeployInfo(command, response, null, aliasOrConnection, projectPath);
                return notification.success( uri, `${NO_CODE_COVERAGE_INFO}`, false, notificationTitle)
            } else {
                // Fallback to standard(non-quick) deployment
                return this.mdapiDeploy(command, constants, artifact, aliasOrConnection, type, DIRECTORY, projectPath);
            }
        })
        .then(result => logger.debug(result))
        .catch(error => {
            logger.error(error);
            reject(error);
        });
    }
}


// Export methods
module.exports = {
    artifactProcessor,
    deploymentProcessor,
    applyGitTag
};
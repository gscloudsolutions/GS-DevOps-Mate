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
const shellJS = require('shelljs');
const path = require('path');
const fs = require('fs-extra');
const program = require('commander');
const authenticate = require('./authenticate');
const logger = require('./utils/logger');

const NO_RECORD_FOUND_ERROR_CODE = 21;
const NO_SETTINGS_FOUND_ERROR_CODE = 22;


const getDeploymentInfo = (moduleName, conn, buildId) => new Promise((resolve, reject) => {
    try {
        const pathToStoreDeploymentInfoJSON = path.dirname(__dirname);
        // if (!fs.existsSync(`${pathToStoreDeploymentInfoJSON}/deploymentInfo_${buildId}.json`)) {
        conn.query(`SELECT Id, Name, Module_Name__c, Git_Tag__c, Commit_SHA__c FROM Deployment_Info__c WHERE Module_Name__c = '${moduleName}' limit 1`, (err, result) => {
            if (err) {
                logger.error('errorCode: ', err.errorCode);
                if (err.errorCode === 'INVALID_TYPE') {
                    resolve(NO_SETTINGS_FOUND_ERROR_CODE);
                }
                reject(err);
            }
            logger.debug(`totalSize : ${result.totalSize}`);
            logger.debug(`fetched records length : ${result.records.length}`);
            if (result.records.length === 0) {
                resolve(NO_RECORD_FOUND_ERROR_CODE);
            }
            // Saves the result json as a file
            logger.debug('record: ', result.records[0]);
            if (buildId && !fs.existsSync(`${pathToStoreDeploymentInfoJSON}/deploymentInfo_${buildId}.json`)) {
                logger.debug('pathToStoreDeploymentInfoJSON: ', pathToStoreDeploymentInfoJSON);
                logger.debug(`deploymentInfo.json path with name of the file : ${pathToStoreDeploymentInfoJSON}/deploymentInfo_${buildId}.json`);
                fs.writeJSONSync(`${pathToStoreDeploymentInfoJSON}/deploymentInfo_${buildId}.json`, result.records[0], { spaces: '\t' });
            }
            resolve(result);
        });
        // }
    } catch (exception) {
        reject(exception);
    }
});

const updateDeploymentInfo = (moduleName, commitSHA, tag, connection, alias) => new Promise((resolve, reject) => {
    getDeploymentInfo(moduleName, connection)
        .then((response) => {
            logger.debug(`moduleName: ${moduleName}, commitSHA: ${commitSHA}, tag: ${tag}, accessToken: ${connection.accessToken}, alias: ${alias}`);
            let targetUserName;
            if (connection) {
                targetUserName = connection.accessToken;
            } else if (alias) {
                targetUserName = alias;
            }
            logger.debug('response: ', response);
            if (response.totalSize === 1) {
                // Custom Setting and record does exists, update it with the new commitSHA and tag
                let recordDetails = '';
                if (tag) {
                    recordDetails += `Git_Tag__c=${tag} `;
                }
                if (commitSHA) {
                    recordDetails += `Commit_SHA__c=${commitSHA}`;
                }
                logger.debug('recordDetails: ', recordDetails);
                shellJS.exec(`SFDX_JSON_TO_STDOUT=true sfdx force:data:record:update -s Deployment_Info__c -i ${response.records[0].Id} -v "${recordDetails}" -u ${targetUserName} --json`,
                    (code, stdout, stderr) => {
                        logger.debug('Status Code: ', code);
                        if (code !== 0) {
                            logger.error(stdout);
                            reject(stdout);
                        }
                        resolve('Existing Deployment_Info__c record got updated');
                    });
            } else if (response === NO_SETTINGS_FOUND_ERROR_CODE) { // Settings does not exist
                logger.debug('No DeploymentInfo settings found');
                const deploymentInfoModulePath = path.join(path.dirname(__dirname), 'DeploymentInfo');
                logger.debug('deploymentInfoModulePath: ', deploymentInfoModulePath);
                const output = shellJS.exec(`sfdx force:mdapi:deploy -d ${deploymentInfoModulePath} -u ${targetUserName} --json -w -1`);
                if (output === '') {
                    reject(new Error('Something went wrong while trying to deploy the DeploymentInfoModule'));
                }
            }
            // Record does not exists, create a new one
            if (response === NO_SETTINGS_FOUND_ERROR_CODE || response === NO_RECORD_FOUND_ERROR_CODE) {
                const recordDetails = `Name=${moduleName} Git_Tag__c=${tag} Commit_SHA__c=${commitSHA} Module_Name__c=${moduleName}`;
                shellJS.exec(`SFDX_JSON_TO_STDOUT=true sfdx force:data:record:create -s Deployment_Info__c -v "${recordDetails}" -u ${targetUserName} --json`,
                    (code, stdout, stderr) => {
                        logger.debug('Status Code: ', code);
                        logger.debug(stdout);
                        /* if (stderr) {
                            logger.error(stderr);
                            // Absorbing this error(instead of rejecting, resolving) as this does not actually indicate the failure
                            // of the pipeline
                            resolve(stderr);
                        } */
                        // const resultJSON = JSON.parse(stdout, true);
                        // resolve(resultJSON.result);
                        resolve('New record got created');
                    });
            }
        });
});

const updateDeploymentInfoByName = (moduleName, commitSHA,
    targetUserName) => new Promise((resolve, reject) => {
    shellJS.exec(`sfdx force:data:record:update -s Deployment_Info__c -w "Module_Name__c='${moduleName}'" -v "Commit_SHA__c='${commitSHA}'" -u ${targetUserName} --json`,
        (code, stdout, stderr) => {
            logger.debug('Status Code: ', code);
            if (code !== 0) {
                logger.error(stderr);
                reject(stderr);
            }
            // const resultJSON = JSON.parse(stdout, true);
            // logger.debug('deploymentInfoService.js: updateDeploymentInfoByName: resultJSON: ', resultJSON);
            // resolve(resultJSON.result);
            resolve('Existing Deployment_Info__c record got updated');
        });
});

// Various Command Definitions and Actions for Deployment Info Custom Settings
program
    .description('Set of commands to CRU for Deployment Info Custom Settings');

program
    .command('get')
    .description('Get the Commit SHA/Commit Tag for latest deployment in a target org')
    .option('-n --module <name>', 'modulename to get its latest state in the target')
    .option('-u --targetUserName <uname>', 'username/alias/access token for the target org.')
    .option('-i --buildId <id>', 'buildId/buildnumber to distinguish the deployment info in the target org.')
    .option('-s --password <secret>', 'password for the target org add secret token as well if the target system is not open for the ip ranges.')
    .option('-t --envType <type>', 'either SANDBOX, PRODUCTION, DEVELOPER or SCRATCH')
    .action((command) => {
        // TODO: Add Required fields validation
        // if (command.password) {
        const { module, buildId } = command;
        logger.debug('module: ', module);
        logger.debug('buildId: ', buildId);
        if (!command.envType) {
            logger.error('-t --envType is required with username-password based deployment');
            process.exit(1);
        }
        authenticate.loginWithCreds(command.targetUserName, command.password, command.envType)
            .then(connection => getDeploymentInfo(module, connection, buildId))
            .then((message) => {
                logger.debug(message);
                process.exit(0);
            })
            .catch((err) => {
                logger.debug(err);
                process.exit(1);
            });
        /* }else {
            getDeploymentInfo(command.module, command.targetUserName, command.buildId)
                .then((message) => {
                    logger.debug(message);
                    process.exit(0);
                })
                .catch((err) => {
                    logger.debug(err);
                    process.exit(1);
                });
        } */ // TODO:  Access Token based implementation
    });

program
    .command('updateByName')
    .description('Updates the commit revision value based on the module name passed for a deployment info custom settings record')
    .option('-n --module <name>', 'module name of the deployment info custom settings record to be updated')
    .option('-u --targetUserName <uname>', 'username/alias/access token for the target org.')
    .option('-s --password <secret>', 'password for the target org add secret token as well if the target system is not open for the ip ranges.')
    .option('-r --revision <sha>', 'short SHA based commit revision.')
    .option('-t --envType <type>', 'either SANDBOX, PRODUCTION, DEVELOPER or SCRATCH')
    .action((command) => {
        const {
            module, targetUserName, password, envType, revision,
        } = command;
        if (password) {
            logger.debug('module: ', module);
            if (!command.envType) {
                logger.error('-t --envType is required with username-password based deployment');
                process.exit(1);
            }
            authenticate.loginWithCreds(targetUserName, password, envType)
                .then((connection) => {
                    // set the url configuration, required in case of running sfdx commands with access token
                    shellJS.exec(`sfdx force:config:set instanceUrl=${connection.instanceURL} --global`);
                    return updateDeploymentInfoByName(module, revision, connection.accessToken);
                })
                .then((message) => {
                    logger.debug(message);
                    process.exit(0);
                })
                .catch((err) => {
                    logger.debug(err);
                    process.exit(1);
                });
        } else {
            updateDeploymentInfoByName(module, revision, targetUserName)
                .then((message) => {
                    logger.debug(message);
                    process.exit(0);
                })
                .catch((err) => {
                    logger.error(err);
                    process.exit(1);
                });
        }
    });

// Export methods
module.exports = {
    getDeploymentInfo,
    updateDeploymentInfo,
};

program.parse(process.argv);

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

const logger = require('../utils/logger');
const fetchRootPath = require('../main').fetchRootPath;

const NO_RECORD_FOUND_ERROR_CODE = 21;
const NO_SETTINGS_FOUND_ERROR_CODE = 22;

/**
 * @description      : To get Deployment Info Record
 * @param command    : Nodejs Program Command
 * @author           : Groundswell Cloud Solutions
 */
const getObject = function(command){

    const deploymentInfoPath = path.dirname(__dirname);

    logger.debug('deploymentInfoPath: ', deploymentInfoPath);
    logger.debug(`pathToStoreDeploymentInfoJSON: ${deploymentInfoPath}/deploymentInfo_${command.buildId}.json`);

    const deploymentInfoObject  = fs.existsSync(`${deploymentInfoPath}/deploymentInfo_${command.buildId}.json`)
                                ? fs.readJSONSync(`${deploymentInfoPath}/deploymentInfo_${command.buildId}.json`)
                                : null;
    logger.debug(`Deployment Info Object::: ${deploymentInfoObject}`);
    return deploymentInfoObject;
}



const getDeploymentInfo = (moduleName, conn, buildId) => new Promise((resolve, reject) => {
    try {
        const pathToStoreDeploymentInfoJSON = path.dirname(__dirname);
        // if (!fs.existsSync(`${pathToStoreDeploymentInfoJSON}/deploymentInfo_${buildId}.json`)) {
        conn.query(`SELECT Id, Name, Module_Name__c, Git_Tag__c, Commit_SHA__c,Deployment_Id__c FROM Deployment_Info__c WHERE Module_Name__c = '${moduleName}' LIMIT 1`, (err, result) => {
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

const updateDeploymentInfo = (moduleName, commitSHA, tag, connection, alias, deploymentRes) => new Promise((resolve, reject) => {
    logger.debug(deploymentRes);
    let res = JSON.parse(deploymentRes);
    let result = res.result;


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
                if (commitSHA && !result.checkOnly) {
                    recordDetails += `Commit_SHA__c=${commitSHA} `;
                }

                if(result.checkOnly){
                    recordDetails += `Deployment_Id__c=${result.id}`;
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
                const deploymentInfoModulePath = path.join(path.dirname(fetchRootPath()), 'DeploymentInfo');
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

const updateDeploymentId = (moduleName, commitSHA,
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



// Export methods
module.exports = {
    getObject,
    getDeploymentInfo,
    updateDeploymentInfo,
    updateDeploymentInfoByName
};

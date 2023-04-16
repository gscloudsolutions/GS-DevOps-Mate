/* Copyright (c) 2019-2023 Groundswell Cloud Solutions Inc. - All Rights Reserved
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF
 * ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
 * USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import shellJS from "shelljs";
import path from "path";

import logger from "../utils/logger";
import fetchRootPath from "../main";
import { loginWithCredentials, loginWithJWT } from "./authenticationService";

async function handleSFDXCommandRun(sfdxCommand) {
    return shellJS.exec(sfdxCommand, (status, stdout, stderr) => {
        logger.debug("status: ", status);
        if (status === 0) {
            logger.debug("stdout: ", stdout);
        }
        if (status !== 0) {
            logger.debug("stderr: ", stderr);
            handleSFDXCommandRun(sfdxCommand);
        }
    });
}

async function checkMyDomainPropagation(scratchAlias) {
    return new Promise((resolve, reject) => {
        try {
            const deploymentInfoModulePath = path.join(path.dirname(fetchRootPath()), "MyDomainChecker");
            const sfdxCommand = `sfdx force:mdapi:deploy -d ${deploymentInfoModulePath} -u ${scratchAlias} --json -w 21 -c`;
            logger.debug("executing command :: ", sfdxCommand);
            handleSFDXCommandRun(sfdxCommand);
            resolve("Successfully created scratch org with my domain propagation");
        } catch (error) {
            logger.error(error);
            reject(error);
        }
    });
}

/**
 * @author Groundswell - Henry Zhao - henry@gscloudsolutions.com
 * @date 2019-05-16
 *
 * @description Authenticates a devhub via JWT, then creates a scratch org using parameters.
 *
 * @param scratchAlias - Alias name for the scratch org. Must be unique
 * @param definitionFilePath - Relative file path to the scratch org definition json file
 * @param devHubAlias - Alias of Dev Hub for authorizing the Dev Hub
 * @param clientId - Client Id of the connected app on the dev hub for JWT authentication
 * @param serverKeyPath - Encrypted JWT Server Key full path
 * @param envType - either SANDBOX, PRODUCTION or SCRATCH
 * @param decryptionKey - Decryption Key to decrypt the encrypted secret key
 * @param decryptionIV - Decryption Initialization Vector
 * @param username - Username of the dev hub that needs to be authenticated
 * @param password - Password of the dev hub that needs to be authenticated
 * @param duration - OPTIONAL how long the scratch org should be available for. Default = 7
 * @return {Promise<S1|S2>|Promise|Promise<S>|Promise<Array<*>>|Deferred} - JSON containing orgId and username of new scratch org.
 */
export async function createScratchOrg(
    scratchAlias,
    definitionFilePath,
    devHubAlias,
    clientId,
    serverKeyPath,
    envType,
    decryptionKey,
    decryptionIV,
    username,
    password,
    duration = 7
) {
    return new Promise((resolve, reject) => {
        if (devHubAlias) {
            loginWithJWT(clientId, serverKeyPath, username, devHubAlias, envType, decryptionKey, decryptionIV)
                .then((result) => {
                    logger.debug(result);
                    const sfdxCommand = `sfdx force:org:create -d ${duration} -v ${devHubAlias} -f ${definitionFilePath} -a ${scratchAlias} -w 20 --json`;
                    logger.debug("executing command :: ", sfdxCommand);
                    shellJS.exec(sfdxCommand, (status, stdout, stderr) => {
                        logger.debug("status: ", status);
                        if (status === 0) {
                            logger.debug("stdout: ", stdout);
                            // Check for My Domain Propagation
                            checkMyDomainPropagation(scratchAlias);
                        } else {
                            logger.error("stderr: ", stderr);
                            reject(stderr);
                        }
                    });
                })
                .catch((error) => {
                    logger.error(error);
                    reject(error);
                });
        } else if (username && password) {
            loginWithCredentials(username, password, envType)
                .then((connection) => {
                    // eslint-disable-next-line max-len
                    // set the url configuration, required in case of running sfdx commands with access token
                    shellJS.exec(`sfdx force:config:set instanceUrl=${connection.instanceURL} --global`);
                    const sfdxCommand = `sfdx force:org:create -d ${duration} -v '${connection.accessToken}' -f ${definitionFilePath} -a ${scratchAlias} -w 20 --json`;
                    logger.debug("createScratchOrg: ", "executing command :: ", sfdxCommand);
                    shellJS.exec(sfdxCommand, (status, stdout, stderr) => {
                        logger.debug("status: ", status);
                        if (status === 0) {
                            logger.debug("stdout: ", stdout);
                            // Check for My Domain Propagation
                            checkMyDomainPropagation(scratchAlias);
                        } else {
                            logger.error("stderr: ", stderr);
                            reject(stderr);
                        }
                    });
                })
                .catch((error) => {
                    logger.error(error);
                    reject(error);
                });
        }
    });
}

// Deletes a scratch org if the DevHub is authenticated with username/password
export async function deleteScratchOrg(orgAlias, username, password, envType) {
    return new Promise((resolve, reject) => {
        loginWithCredentials(username, password, envType)
            .then((connection) => {
                // eslint-disable-next-line max-len
                // set the url configuration, required in case of running sfdx commands with access token
                shellJS.exec(`sfdx force:config:set instanceUrl=${connection.instanceURL} --global`);
                const sfdxCommand = `sfdx force:org:delete -p -u ${orgAlias} -v ${connection.accessToken}  --json`;
                logger.debug("executing command :: ", sfdxCommand);
                shellJS.exec(sfdxCommand, (status, stdout, stderr) => {
                    logger.debug("status: ", status);
                    if (status === 0) {
                        logger.debug("stdout: ", stdout);
                    } else {
                        logger.debug("stderr: ", stderr);
                        reject(stderr);
                    }
                });
            })
            .catch((error) => {
                logger.error(error);
                reject(error);
            });
    });
}

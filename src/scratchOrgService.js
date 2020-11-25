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
const program = require('commander');
const path = require('path');

const authenticate = require('./authenticate');
const logger = require('./utils/logger');

const {
    SF_CLIENT_ID, SF_SF_ENV_TYPE, DECRYPTION_KEY, SF_DECRYPTION_IV, SF_USERNAME, SF_PASSWORD,
} = process.env;

const handleSFDXCommandRun = (sfdxCommand) => {
    shellJS.exec(sfdxCommand,
        (status, stdout, stderr) => {
            logger.debug('status: ', status);
            if (status === 0) {
                logger.debug('stdout: ', stdout);
            }
            if (status !== 0) {
                logger.debug('stderr: ', stderr);
                handleSFDXCommandRun(sfdxCommand);
            }
        });
};

const checkMyDomainPropagation = scratchAlias => new Promise((resolve, reject) => {
    try {
        const deploymentInfoModulePath = path.join(path.dirname(__dirname), 'MyDomainChecker');
        const sfdxCommand = `sfdx force:mdapi:deploy -d ${deploymentInfoModulePath} -u ${scratchAlias} --json -w 21 -c`;
        logger.debug('executing command :: ', sfdxCommand);
        handleSFDXCommandRun(sfdxCommand);
        resolve('Successfully created scratch org with my domain propagation');
    } catch (error) {
        logger.error(error);
        reject(error);
    }
});

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
const createScratchOrg = (scratchAlias, definitionFilePath, devHubAlias,
    clientId, serverKeyPath, envType,
    decryptionKey, decryptionIV, username,
    password, duration = 7) => new Promise((resolve, reject) => {
    if (devHubAlias) {
        authenticate.loginWithJWT(clientId, serverKeyPath, username, devHubAlias, envType,
            decryptionKey, decryptionIV)
            .then((result) => {
                logger.debug(result);
                const sfdxCommand = `sfdx force:org:create -d ${duration} -v ${devHubAlias} -f ${definitionFilePath} -a ${scratchAlias} -w 20 --json`;
                logger.debug('executing command :: ', sfdxCommand);
                shellJS.exec(sfdxCommand,
                    (status, stdout, stderr) => {
                        logger.debug('status: ', status);
                        if (status === 0) {
                            logger.debug('stdout: ', stdout);
                            // Check for My Domain Propagation
                            checkMyDomainPropagation(scratchAlias);
                        } else {
                            logger.error('stderr: ', stderr);
                            reject(stderr);
                        }
                    });
            })
            .catch((error) => {
                logger.error(error);
                reject(error);
            });
    } else if (username && password) {
        authenticate.loginWithCreds(username, password, envType)
            .then((connection) => {
                // eslint-disable-next-line max-len
                // set the url configuration, required in case of running sfdx commands with access token
                shellJS.exec(`sfdx force:config:set instanceUrl=${connection.instanceURL} --global`);
                const sfdxCommand = `sfdx force:org:create -d ${duration} -v '${connection.accessToken}' -f ${definitionFilePath} -a ${scratchAlias} -w 20 --json`;
                logger.debug('createScratchOrg: ', 'executing command :: ', sfdxCommand);
                shellJS.exec(sfdxCommand,
                    (status, stdout, stderr) => {
                        logger.debug('status: ', status);
                        if (status === 0) {
                            logger.debug('stdout: ', stdout);
                            // Check for My Domain Propagation
                            checkMyDomainPropagation(scratchAlias);
                        } else {
                            logger.error('stderr: ', stderr);
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

// Deletes a scratch org if the DevHub is authenticated with username/password
const deleteScratchOrg = (orgAlias, username, password, envType) => new Promise((resolve, reject) => {
    authenticate.loginWithCreds(username, password, envType)
        .then((connection) => {
            // eslint-disable-next-line max-len
            // set the url configuration, required in case of running sfdx commands with access token
            shellJS.exec(`sfdx force:config:set instanceUrl=${connection.instanceURL} --global`);
            const sfdxCommand = `sfdx force:org:delete -p -u ${orgAlias} -v ${connection.accessToken}  --json`;
            logger.debug('executing command :: ', sfdxCommand);
            shellJS.exec(sfdxCommand,
                (status, stdout, stderr) => {
                    logger.debug('status: ', status);
                    if (status === 0) {
                        logger.debug('stdout: ', stdout);
                    } else {
                        logger.debug('stderr: ', stderr);
                        reject(stderr);
                    }
                });
        })
        .catch((error) => {
            logger.error(error);
            reject(error);
        });
});

program
    .description('Set of commands to manage scratch orgs on Salesforce.');

program
    .command('createOrg')
    .description('Creates a scratch org authenticated from the Dev Hub')
    .option('-x, --newAlias <orgAlias>', 'Alias for the new scratch org')
    .option('-p, --definitionPath <filePath>', 'File path to the scratch org definition file.')
    .option('-a, --devHubAlias <orgAlias>', 'Alias name for the DevHub to be authenticated.')
    .option('-i, --clientId <id>', 'The clientId from the Salesforce Connected App.')
    .option('-k, --serverKey <keyLocation>', 'Encrypted JWT Server Key full path, non-encrypted key path from services like Azure where secure file is available')
    .option('-t, --envType <type>', 'The environment type of target Org. Either SANDBOX, PRODUCTION, or DEVELOPER.')
    .option('-d, --decryptionKey <dKey>', 'Decryption Key to decrypt the encrypted secret key')
    .option('-v, --decryptionIV <dIV>', 'Decryption Initialization Vector')
    .option('-u, --sfUsername <username>', 'Username of the dev hub from which Scratch Org is to be created')
    .option('-s, --sfPassword <password>', 'Password of the dev hub from which Scratch Org is to be created')
    .option('-l, --scratchOrgLength <integer>', 'Length of time for scratch org to be valid for. DEFAULT=7')
    .action((command) => {
        const scratchAlias = command.newAlias;
        const definitionFilePath = command.definitionPath;
        const { devHubAlias } = command;
        const clientId = command.clientId ? command.clientId : SF_CLIENT_ID;
        const serverKeyPath = command.serverKey;
        const envType = command.envType ? command.envType : SF_SF_ENV_TYPE;
        const decryptionKey = command.decryptionKey ? command.decryptionKey : DECRYPTION_KEY;
        const decryptionIV = command.decryptionIV ? command.decryptionIV : SF_DECRYPTION_IV;
        const username = command.sfUsername ? command.sfUsername : SF_USERNAME;
        const password = command.sfPassword ? command.sfPassword : SF_PASSWORD;
        const duration = command.scratchOrgLength ? command.scratchOrgLength : 7;

        createScratchOrg(scratchAlias,
            definitionFilePath,
            devHubAlias,
            clientId,
            serverKeyPath,
            envType,
            decryptionKey,
            decryptionIV,
            username,
            password,
            duration)
            .then((result) => {
                logger.debug(result);
                process.exit(0);
            })
            .catch((error) => {
                logger.error(error);
                process.exit(1);
            });
    });


program
    .command('deleteOrg')
    .description('Deletes a scratch org authenticated from the Dev Hub using username/password')
    .option('-a, --orgAlias <orgAlias>', 'Alias/Username for the scratch org to be deleted')
    .option('-u, --sfUsername <username>', 'Username of the dev hub from which Scratch Org to be deleted is created')
    .option('-s, --sfPassword <password>', 'Password of the dev hub from which Scratch Org to be deleted is created')
    .option('-t, --envType <type>', 'The environment type of the Dev Hub Org, from which the Scratch Org to be deleted is created. Either SANDBOX, PRODUCTION OR DEVELOPER.')
    .action((command) => {
        const envType = command.envType ? command.envType : SF_SF_ENV_TYPE;
        const username = command.sfUsername ? command.sfUsername : SF_USERNAME;
        const password = command.sfPassword ? command.sfPassword : SF_PASSWORD;

        deleteScratchOrg(command.orgAlias, username, password, envType)
            .then((result) => {
                logger.debug(result);
                process.exit(0);
            })
            .catch((error) => {
                logger.error(error);
                process.exit(1);
            });
    });

program.parse(process.argv);

module.exports = {
    createScratchOrg,
    deleteScratchOrg,
};

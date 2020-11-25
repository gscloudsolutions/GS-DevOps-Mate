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

const jsforce = require('jsforce');
const shellJS = require('shelljs');
const program = require('commander');
const logger = require('./utils/logger');

const SALESFORCE_ENV = {
    SANDBOX: 'https://test.salesforce.com',
    SCRATCH: 'https://test.salesforce.com',
    PRODUCTION: 'https://login.salesforce.com',
    DEVELOPER: 'https://login.salesforce.com',
};

/**
 * @author Groundswell - Henry Zhao - henry@gscloudsolutions.com
 * @date 2019-04-30
 *
 * @description Logs into a Salesforce instance with the provided information
 * @param username - Salesforce username
 * @param password - Salesforce password + security token COMBINED
 * @param environmentType - Specifies type of environment, either SANDBOX or PRODUCTION
 * @return An Object containing InstanceURL and AccessToken
 */
const loginWithCreds = (username, password, environmentType) => new Promise((resolve, reject) => {
    try {
    // establish connection based on environment type
        const LOGIN_URL = SALESFORCE_ENV[environmentType.toUpperCase()]
            ? SALESFORCE_ENV[environmentType.toUpperCase()] : environmentType;
        logger.info('LOGIN_URL: ', LOGIN_URL);
        const conn = new jsforce.Connection({
            loginUrl: LOGIN_URL,
        });
        // try to login to the connection via username/password
        conn.login(username, password, (err) => {
            if (err) {
                logger.error(err);
                reject(err);
            }
            // can change this resolve later to return more information, so far only need access token
            // and instance url
            if (conn.accessToken) {
                logger.trace('jsforceAuthenticate.js :: accessToken :: ', conn.accessToken);
                conn.instanceURL = conn.instanceUrl;
                // resolve({
                //   instanceURL: conn.instanceUrl,
                //   accessToken: conn.accessToken,
                // });
                resolve(conn);
            } else {
                reject(new Error('Invalid access token.'));
            }
        });
    } catch (exception) {
        reject(exception);
    }
});

const loginWithJWT = (clientId, severyKeyPath, sfUsername, orgAlias,
    envType, decryptionKey, decryptionIV) => new Promise(
    (resolve, reject) => {
        try {
            let command = '';
            // If decryptionKey and decryptionIV are passed it means the jwt server key
            // is encrypted and thus needs decryption
            if (decryptionKey && decryptionIV) {
                // Decrypt the server key
                shellJS.exec(`openssl enc -nosalt -aes-256-cbc -d -in ${severyKeyPath} -out ${__dirname}/server.key -base64 -K ${decryptionKey} -iv ${decryptionIV}`);
                // Constructing the command
                command = `sfdx force:auth:jwt:grant --clientid ${clientId} --jwtkeyfile ${__dirname}/server.key --username ${sfUsername} --setalias ${orgAlias} --instanceurl ${SALESFORCE_ENV[envType.toUpperCase()]}`;
            } else {
                // Constructing the command
                command = `sfdx force:auth:jwt:grant --clientid ${clientId} --jwtkeyfile ${severyKeyPath} --username ${sfUsername} --setalias ${orgAlias} --instanceurl ${SALESFORCE_ENV[envType.toUpperCase()]}`;
            }

            logger.info('command: ', command);
            shellJS.exec(command, (status, stdout, stderr) => {
                logger.info('status: ', status);
                if (status === 0) {
                    logger.info('stdout: ', stdout);
                    resolve(stdout);
                }
                if (status !== 0) {
                    logger.error('stderr: ', stderr);
                    reject(stderr);
                }
            });
        } catch (exception) {
            reject(exception);
        }
    },
);

program
    .description('Set of commands to authenticate with Salesforce orgs');

program
    .command('loginWithCreds')
    .description('Log in to a salesforce org with username and password. Returns the auth token and instance URL.')
    .option('-u, --username <username>', 'The username of the authenticating Org.')
    .option('-p, --password <password>', 'The password of the authenticating Org.')
    .option('-t, --envType <SANDBOX|PRODUCTION|DEVELOPER|SCRATCH>', 'The environment type of the authenticating Org. Either SANDBOX, PRODUCTION, DEVELOPER or SCRATCH.')
    .action((command) => {
        let envType = 'PRODUCTION';
        if (!command.username || !command.password) {
            logger.error('--u username and -p --password are required params');
            process.exit(1);
        }
        envType = command.envType.toString();
        loginWithCreds(command.username, command.password, envType)
            .then((response) => {
                logger.trace(response);
                process.exit(0);
            })
            .catch((err) => {
                logger.error(err);
                process.exit(1);
            });
    });

program
    .command('loginWithJWT')
    .description('Log in to a salesforce org using JWT authentication method.')
    .option('-i, --clientId <id>', 'The clientId from the Salesforce Connected App.')
    .option('-u, --sfUsername <username>', 'The username of the authenticating Org.')
    .option('-a, --orgAlias <alias>', 'Alias for the org to be authenticated.')
    .option('-k, --serverKey <keyLocation>', 'Full path to the encrypted JWT Server Key.')
    .option('-d, --decryptionKey <dKey>', 'Decryption Key to decrypt the encrypted server key.')
    .option('-v, --decryptionIV <dIV>', 'Decryption Initialization Vector.')
    .option('-t, --envType <SANDBOX|PRODUCTION|SCRATCH>', 'The environment type of the authenticating Org. Either SANDBOX, PRODUCTION or SCRATCH.')
    .action((command) => {
        let envType = 'PRODUCTION';
        logger.info(command);
        if (!command.clientId || !command.sfUsername
      || !command.orgAlias || !command.serverKey) {
            logger.error('-i --clientId, -u --sfUsername, -a --orgAlias and -k --serverKey are required params');
            process.exit(1);
        }
        envType = command.envType.toString();
        loginWithJWT(command.clientId, command.serverKey, command.sfUsername, command.orgAlias,
            envType, command.decryptionKey, command.decryptionIV)
            .then((response) => {
                logger.info(response);
                process.exit(0);
            })
            .catch((err) => {
                logger.error(err);
                process.exit(1);
            });
    });

// Export methods
module.exports = {
    loginWithCreds,
    loginWithJWT,
};

program.parse(process.argv);

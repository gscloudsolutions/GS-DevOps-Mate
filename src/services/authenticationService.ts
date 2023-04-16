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

import jsforce from "jsforce";
import shellJS from "shelljs";
import logger from "../utils/logger";

const SALESFORCE_ENV = {
    SANDBOX: "https://test.salesforce.com",
    SCRATCH: "https://test.salesforce.com",
    PRODUCTION: "https://login.salesforce.com",
    DEVELOPER: "https://login.salesforce.com",
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
export async function loginWithCredentials(username, password, environmentType) {
    return new Promise((resolve, reject) => {
        try {
            // establish connection based on environment type
            const LOGIN_URL = SALESFORCE_ENV[environmentType.toUpperCase()]
                ? SALESFORCE_ENV[environmentType.toUpperCase()]
                : environmentType;
            logger.info("LOGIN_URL: ", LOGIN_URL);
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
                    logger.trace("jsforceAuthenticate.js :: accessToken :: ", conn.accessToken);
                    conn.instanceURL = conn.instanceUrl;
                    // resolve({
                    //   instanceURL: conn.instanceUrl,
                    //   accessToken: conn.accessToken,
                    // });
                    resolve(conn);
                } else {
                    reject(new Error("Invalid access token."));
                }
            });
        } catch (exception) {
            reject(exception);
        }
    });
}

export async function loginWithJWT(
    clientId,
    severyKeyPath,
    sfUsername,
    orgAlias,
    envType,
    decryptionKey,
    decryptionIV
) {
    return new Promise((resolve, reject) => {
        try {
            let command = "";
            // If decryptionKey and decryptionIV are passed it means the jwt server key
            // is encrypted and thus needs decryption
            if (decryptionKey && decryptionIV) {
                // Decrypt the server key
                shellJS.exec(
                    `openssl enc -nosalt -aes-256-cbc -d -in ${severyKeyPath} -out ${__dirname}/server.key -base64 -K ${decryptionKey} -iv ${decryptionIV}`
                );
                // Constructing the command
                command = `sfdx force:auth:jwt:grant --clientid ${clientId} --jwtkeyfile ${__dirname}/server.key --username ${sfUsername} --setalias ${orgAlias} --instanceurl ${
                    SALESFORCE_ENV[envType.toUpperCase()]
                }`;
            } else {
                // Constructing the command
                command = `sfdx force:auth:jwt:grant --clientid ${clientId} --jwtkeyfile ${severyKeyPath} --username ${sfUsername} --setalias ${orgAlias} --instanceurl ${
                    SALESFORCE_ENV[envType.toUpperCase()]
                }`;
            }

            logger.info("command: ", command);
            shellJS.exec(command, (status, stdout, stderr) => {
                logger.info("status: ", status);
                if (status === 0) {
                    logger.info("stdout: ", stdout);
                    resolve(stdout);
                }
                if (status !== 0) {
                    logger.error("stderr: ", stderr);
                    reject(stderr);
                }
            });
        } catch (exception) {
            reject(exception);
        }
    });
}

/**
 * @description      : To authenticate user since we don't have alias available
 * @param command    : Nodejs Program Command
 * @param constants  : Constants setup from command argument
 * @author           : Groundswell Cloud Solutions
 */
export async function authenticateUser(command, constants) {
    return new Promise((resolve) => {
        /* Run deployment using Alias  */
        if (constants.alias) {
            resolve({ token: constants.alias, type: "alias" });
        } else {
            // If username and password not available stop process
            if (!constants.username || !constants.password) {
                logger.error("Something went wrong, username/password incorrect or one of them is not passed");
                process.exit(1);
            }

            // check if the environment type is available
            if (!constants.envType) {
                logger.error("-t --envType is required with username-password based deployment");
                process.exit(1);
            }

            logger.debug("username/password is passed which means credentials based authentication to be used");

            this.loginWithCreds(constants.username, constants.password, constants.envType)
                .then((connection) => {
                    resolve({ token: connection, type: "connection" });
                })
                .catch((error) => {
                    logger.error(`Error: ${error}`);
                    /* If this point is reached log error */
                    process.exit(1);
                });
        }
    });
}

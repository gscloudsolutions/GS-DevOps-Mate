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

const program = require("commander");
const logger = require("../utils/logger");
const authService = require("../services/authenticationService");

program.description("Set of commands to authenticate with Salesforce orgs");

program
    .command("loginWithCreds")
    .description("Log in to a salesforce org with username and password. Returns the auth token and instance URL.")
    .option("-u, --username <username>", "The username of the authenticating Org.")
    .option("-p, --password <password>", "The password of the authenticating Org.")
    .option(
        "-t, --envType <SANDBOX|PRODUCTION|DEVELOPER|SCRATCH>",
        "The environment type of the authenticating Org. Either SANDBOX, PRODUCTION, DEVELOPER or SCRATCH."
    )
    .action((command) => {
        let envType = "PRODUCTION";
        if (!command.username || !command.password) {
            logger.error("--u username and -p --password are required params");
            process.exit(1);
        }
        envType = command.envType.toString();
        authService
            .loginWithCreds(command.username, command.password, envType)
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
    .command("loginWithJWT")
    .description("Log in to a salesforce org using JWT authentication method.")
    .option("-i, --clientId <id>", "The clientId from the Salesforce Connected App.")
    .option("-u, --sfUsername <username>", "The username of the authenticating Org.")
    .option("-a, --orgAlias <alias>", "Alias for the org to be authenticated.")
    .option("-k, --serverKey <keyLocation>", "Full path to the encrypted JWT Server Key.")
    .option("-d, --decryptionKey <dKey>", "Decryption Key to decrypt the encrypted server key.")
    .option("-v, --decryptionIV <dIV>", "Decryption Initialization Vector.")
    .option(
        "-t, --envType <SANDBOX|PRODUCTION|SCRATCH>",
        "The environment type of the authenticating Org. Either SANDBOX, PRODUCTION or SCRATCH."
    )
    .action((command) => {
        let envType = "PRODUCTION";
        logger.info(command);
        if (!command.clientId || !command.sfUsername || !command.orgAlias || !command.serverKey) {
            logger.error("-i --clientId, -u --sfUsername, -a --orgAlias and -k --serverKey are required params");
            process.exit(1);
        }
        envType = command.envType.toString();
        authService
            .loginWithJWT(
                command.clientId,
                command.serverKey,
                command.sfUsername,
                command.orgAlias,
                envType,
                command.decryptionKey,
                command.decryptionIV
            )
            .then((response) => {
                logger.info(response);
                process.exit(0);
            })
            .catch((err) => {
                logger.error(err);
                process.exit(1);
            });
    });

program.parse(process.argv);

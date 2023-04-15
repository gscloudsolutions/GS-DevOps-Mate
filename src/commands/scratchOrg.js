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

const scracthOrgService = require("../services/scratchOrgService");
const logger = require("../utils/logger");

const { SF_CLIENT_ID, SF_SF_ENV_TYPE, DECRYPTION_KEY, SF_DECRYPTION_IV, SF_USERNAME, SF_PASSWORD } = process.env;

program.description("Set of commands to manage scratch orgs on Salesforce.");

program
    .command("createOrg")
    .description("Creates a scratch org authenticated from the Dev Hub")
    .option("-x, --newAlias <orgAlias>", "Alias for the new scratch org")
    .option("-p, --definitionPath <filePath>", "File path to the scratch org definition file.")
    .option("-a, --devHubAlias <orgAlias>", "Alias name for the DevHub to be authenticated.")
    .option("-i, --clientId <id>", "The clientId from the Salesforce Connected App.")
    .option(
        "-k, --serverKey <keyLocation>",
        "Encrypted JWT Server Key full path, non-encrypted key path from services like Azure where secure file is available"
    )
    .option("-t, --envType <type>", "The environment type of target Org. Either SANDBOX, PRODUCTION, or DEVELOPER.")
    .option("-d, --decryptionKey <dKey>", "Decryption Key to decrypt the encrypted secret key")
    .option("-v, --decryptionIV <dIV>", "Decryption Initialization Vector")
    .option("-u, --sfUsername <username>", "Username of the dev hub from which Scratch Org is to be created")
    .option("-s, --sfPassword <password>", "Password of the dev hub from which Scratch Org is to be created")
    .option("-l, --scratchOrgLength <integer>", "Length of time for scratch org to be valid for. DEFAULT=7")
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

        scracthOrgService
            .createScratchOrg(
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
                duration
            )
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
    .command("deleteOrg")
    .description("Deletes a scratch org authenticated from the Dev Hub using username/password")
    .option("-a, --orgAlias <orgAlias>", "Alias/Username for the scratch org to be deleted")
    .option("-u, --sfUsername <username>", "Username of the dev hub from which Scratch Org to be deleted is created")
    .option("-s, --sfPassword <password>", "Password of the dev hub from which Scratch Org to be deleted is created")
    .option(
        "-t, --envType <type>",
        "The environment type of the Dev Hub Org, from which the Scratch Org to be deleted is created. Either SANDBOX, PRODUCTION OR DEVELOPER."
    )
    .action((command) => {
        const envType = command.envType ? command.envType : SF_SF_ENV_TYPE;
        const username = command.sfUsername ? command.sfUsername : SF_USERNAME;
        const password = command.sfPassword ? command.sfPassword : SF_PASSWORD;

        scracthOrgService
            .deleteScratchOrg(command.orgAlias, username, password, envType)
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

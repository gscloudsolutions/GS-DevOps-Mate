#!/usr/bin/env node

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
import program from "commander";
import shellJS from "shelljs";
import sfcore from "@salesforce/core";
import logger from "../utils/logger";
import { fetchMetadataMappings } from "../utils/manifestUtil";
import { loginWithCredentials } from "../services/authenticationService";

program
    .command("fetch")
    .description("Fetches metadataMappings from the target Org.")
    .option("-u --username <username>", "The username of the target Org.")
    .option(
        "-t --envType <type>",
        "The environment type of target Org. Either SANDBOX, PRODUCTION, DEVELOPER or SCRATCH."
    )
    .option("-s --password <secret>", "The password for the target org appended with the security token.")
    .option(
        "-a --aliasOrUserName <tuname>",
        "The username/alias for the target Org that is already authenticated via JWT."
    )
    .action((command) => {
        let con;
        const { aliasOrUserName, username, password, envType } = command;
        if (aliasOrUserName) {
            // TODO: Get the latest api version
            fetchMetadataMappings(aliasOrUserName);
        } else if (username && password) {
            if (!command.envType) {
                console.error("-t --envType is required with username-password based deployment");
                process.exit(1);
            }
            logger.debug("username/password is passed which means credentials based authentication to be used");
            loginWithCredentials(username, password, envType)
                .then((connection) => {
                    con = connection;
                    return sfcore.Org.create(connection);
                })
                .then((org) => org.retrieveMaxApiVersion())
                .then((maxAPIVersion) => {
                    logger.debug("Max API version: ", maxAPIVersion);
                    logger.debug("connection: ", con);
                    // set the url configuration, required in case of running sfdx commands with access token
                    shellJS.exec(`sfdx force:config:set instanceUrl=${con.instanceURL} --global`);
                    fetchMetadataMappings(con.accessToken, maxAPIVersion);
                })
                .catch((error) => {
                    logger.error(error);
                    process.exit(1);
                });
        } else {
            logger.error("Something went wrong, username/password incorrect or one of them is not passed");
            process.exit(1);
        }
    });

program.parse(process.argv);

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
import shellJS from "shelljs";
import program from "commander";
import fs from "fs-extra";

import logger from "../utils/logger";
import { init } from "../utils/uncaughtExceptionHandler";
import { loginWithCredentials } from "../services/authenticationService";
import { TestLevel, checkTestCoverage, getTestSubmission, renameFiles } from "../services/apexTestingService";
import { sendFailureMessage, sendSuccessMessage } from "../services/apexTestingNotificationService";

// Initializing the generic exception listner
init();

const COMMAND_WAIT_TIME = process.env.COMMAND_WAIT_TIME || 20;

program.description("Set of commands to run test classes on Salesforce.");
program
    .command("runTests")
    .description("Runs specified test classes or levels on target org.")
    .option("-a --targetusername <orgAlias>", "Username/alias/access token for the target org.")
    .option("-d --directoryPath <directoryPath>", "The path to store result artifacts.")
    .option("-b --buildNumber <integer>", "BuildId/BuildNumber for uniquely identifying the test instance.")
    .option("-l --testLevel <testlevel>", "LOCAL_TESTS|ALL_TESTS|SPECIFIED_TESTS Define which test level to execute.")
    .option(
        "-n --testClasses <apexClassName>",
        "A comma separated list of test classes to run. Required if testLevel is SPECIFIEDTESTS"
    )
    .option("-m --minimumPercentage <minPercent>", "Default 75, The minimum test coverage percentage required.")
    .option("-u --username <username>", "Username for the target org")
    .option(
        "-s --password <secret>",
        "Password for the target org add secret token as well if the target system is not open for the ip ranges"
    )
    .option("-t --envType <type>", "Either SANDBOX, PRODUCTION or SCRATCH")
    .option("--slackWebhookUri <uri>", "Slack notification Webhook URI")
    .option("--notificationTitle <title>", "Custom Notification Title for Slack")
    .option("-w --wait <wait>", "Wait time for the command.")
    .action((command) => {
        logger.debug("params:", command);
        logger.debug("targetusername:", command.targetusername);
        logger.debug("directoryPath:", command.directoryPath);
        logger.debug("buildNumber:", command.buildNumber);
        logger.debug("testLevel:", command.testLevel);
        logger.debug("testClasses:", command.testClasses);
        logger.debug("minimumPercentage:", command.minimumPercentage);
        fs.ensureDirSync(command.directoryPath);
        if (!Object.keys(TestLevel).includes(command.testLevel)) {
            logger.error("Invalid test level defined!");
            process.exit(1);
        }
        const waitTime = command.wait || COMMAND_WAIT_TIME;
        let testsRunResults;
        if (!command.targetusername) {
            if (!(command.username && command.password)) {
                logger.error("No JWT alias provided, so username and password are required.");
                process.exit(1);
            }
            if (!command.envType) {
                logger.error("-t --envType is required with username-password based deployment");
                process.exit(1);
            }
            loginWithCredentials(command.username, command.password, command.envType)
                .then((connection) => {
                    // set the url configuration, required in case of running sfdx commands with access token
                    shellJS.exec(`sfdx force:config:set instanceUrl=${connection.instanceURL} --global`);
                    return getTestSubmission(
                        TestLevel[command.testLevel],
                        connection.accessToken,
                        command.directoryPath,
                        command.testClasses,
                        waitTime
                    );
                })
                .then((result) => {
                    logger.debug("runApexTests.js :: ", result.result.summary);
                    return checkTestCoverage(result, command.minimumPercentage || 75);
                })
                .then((result) => {
                    testsRunResults = result;
                    // write the results to an artifact
                    return renameFiles(command.directoryPath, result.result.summary.testRunId, command.buildNumber);
                })
                .catch((error) => {
                    logger.error("runApexTests.js :: ", " :: ", "FAILED :: ", error);
                })
                .finally((result) => {
                    logger.trace("result: ", result);
                    logger.trace("testsRunResults: ", testsRunResults);
                    if (testsRunResults.status === 0) {
                        if (command.slackWebhookUri) {
                            return sendSuccessMessage(
                                command.slackWebhookUri,
                                testsRunResults.result.summary,
                                command.notificationTitle
                            );
                        } else {
                            process.exit(0);
                        }
                    } else {
                        if (command.slackWebhookUri) {
                            return sendFailureMessage(
                                command.slackWebhookUri,
                                testsRunResults.result.summary,
                                command.notificationTitle
                            );
                        } else {
                            process.exit(1);
                        }
                    }
                });
        } else {
            getTestSubmission(
                TestLevel[command.testLevel],
                command.targetusername,
                command.directoryPath,
                command.testClasses,
                waitTime
            )
                .then((result) => {
                    logger.debug("runApexTests.js :: ", result.result.summary);
                    return checkTestCoverage(result, command.minimumPercentage || 75);
                })
                .then((result) => {
                    testsRunResults = result;
                    // write the results to an artifact
                    return renameFiles(command.directoryPath, result.result.summary.testRunId, command.buildNumber);
                })
                .catch((error) => {
                    logger.error("runApexTests.js :: ", " :: ", "FAILED :: ", error);
                })
                .finally((result) => {
                    logger.trace("result: ", result);
                    logger.trace("testsRunResults: ", testsRunResults);
                    if (testsRunResults.status === 0) {
                        if (command.slackWebhookUri) {
                            return sendSuccessMessage(
                                command.slackWebhookUri,
                                testsRunResults.result.summary,
                                command.notificationTitle
                            );
                        } else {
                            process.exit(0);
                        }
                    } else {
                        if (command.slackWebhookUri) {
                            return sendFailureMessage(
                                command.slackWebhookUri,
                                testsRunResults.result.summary,
                                command.notificationTitle
                            );
                        } else {
                            process.exit(1);
                        }
                    }
                });
        }
    });

program.parse(process.argv);

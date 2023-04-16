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
const program = require("commander");

const logger = require("../utils/logger");
const codeScanningService = require("../services/pmdESLintScanningService");

const { TARGET_TO_RUN_SCA, PMD_CONFIG_PATH, ESLINT_CONFIG_PATH, SWITCH_OFF_SCA, SLACK_NOTIFICATION_URI } = process.env;

program.description("Set of commands to perform static code analysis on Salesforce Apex and LWC");

program
    .command("pmd-eslint")
    .description("Scans the code utilizing PMD and ESLint as static code analysis tools")
    .option("-t --target <target>", "location of source code(required)")
    .option("-e --eslintconfig <eslintconfig>", "location of eslintrc config to customize eslint engine")
    .option("-p --pmdconfig <pmdconfig>", "location of PMD rule reference XML file to customize rule selection")
    .option("-i --ignore <ignore>", "pass true and this command will not run")
    .option("--slackWebhookUri <uri>", "Slack notification Webhook URI")
    .option("--notificationTitle <title>", "Custom Notification Title for Slack")
    .action(async (command) => {
        try {
            logger.debug("command.target", command.target);
            const targetToRunSCA = command.target || TARGET_TO_RUN_SCA;
            const pmdConfigPath = command.pmdconfig || PMD_CONFIG_PATH;
            const eslintconfig = command.eslintconfig || ESLINT_CONFIG_PATH;
            let ignore = false; // Default is should not ignore
            if (command.ignore !== undefined) {
                ignore = command.ignore;
            } else if (SWITCH_OFF_SCA !== undefined) {
                ignore = SWITCH_OFF_SCA;
            }
            const SLACK_WEBHOOK_URI = command.slackWebhookUri || SLACK_NOTIFICATION_URI;
            const NOTIF_TITLE = command.notificationTitle || "Static Code Analysis Run Results";
            if (ignore === true || ignore === "true") {
                logger.info("SCA command is switched off, do nothing");
            } else {
                const isSCAFailed = await codeScanningService.scan(
                    targetToRunSCA,
                    pmdConfigPath,
                    eslintconfig,
                    SLACK_WEBHOOK_URI,
                    NOTIF_TITLE
                );
                logger.debug("isSCAFailed: ", isSCAFailed);
                // Take action based on the result - Exit process, Send a Slack notification
                if (isSCAFailed) {
                    process.exit(1);
                }
                process.exit(0);
            }
        } catch (error) {
            logger.error(error);
            process.exit(1); // Exits with error code which is 1
        }
    });

program.parse(process.argv);

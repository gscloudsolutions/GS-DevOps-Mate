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
const fs = require('fs-extra');


const authenticate = require('../services/authenticationService');
const apexTestingService = require('../services/apexTestingService');
const notificationService = require('../services/apexTestingNotificationService');
const logger = require('../utils/logger');
const genericExceptionHandler = require('../utils/uncaughtExceptionHandler');

// Initializing the generic exception listner
genericExceptionHandler.init();

const COMMAND_WAIT_TIME = process.env.COMMAND_WAIT_TIME || 20;

program
    .description('Set of commands to run test classes on Salesforce.');
program
    .command('runTests')
    .description('Runs specified test classes or levels on target org.')
    .option('-a --targetusername <orgAlias>', 'Username/alias/access token for the target org.')
    .option('-d --directoryPath <directoryPath>', 'The path to store result artifacts.')
    .option('-b --buildNumber <integer>', 'BuildId/BuildNumber for uniquely identifying the test instance.')
    .option('-l --testLevel <testlevel>', 'LOCAL_TESTS|ALL_TESTS|SPECIFIED_TESTS Define which test level to execute.')
    .option('-n --testClasses <apexClassName>', 'A comma separated list of test classes to run. Required if testLevel is SPECIFIEDTESTS')
    .option('-m --minimumPercentage <minPercent>', 'Default 75, The minimum test coverage percentage required.')
    .option('-u --username <username>', 'Username for the target org')
    .option('-s --password <secret>', 'Password for the target org add secret token as well if the target system is not open for the ip ranges')
    .option('-t --envType <type>', 'Either SANDBOX, PRODUCTION or SCRATCH')
    .option('--slackWebhookUri <uri>', 'Slack notification Webhook URI.')
    .option('-w --wait <wait>', 'Wait time for the command.')
    .action((command) => {
        logger.debug('params:', command);
        logger.debug('targetusername:', command.targetusername);
        logger.debug('directoryPath:', command.directoryPath);
        logger.debug('buildNumber:', command.buildNumber);
        logger.debug('testLevel:', command.testLevel);
        logger.debug('testClasses:', command.testClasses);
        logger.debug('minimumPercentage:', command.minimumPercentage);
        fs.ensureDirSync(command.directoryPath);
        if (!Object.keys(apexTestingService.testLevel).includes(command.testLevel)) {
            logger.error('Invalid test level defined!');
            process.exit(1);
        }
        let waitTime = command.wait || COMMAND_WAIT_TIME;
        if (!command.targetusername) {
            if (!(command.username && command.password)) {
                logger.error('No JWT alias provided, so username and password are required.');
                process.exit(1);
            }
            if (!command.envType) {
                logger.error('-t --envType is required with username-password based deployment');
                process.exit(1);
            }
            authenticate.loginWithCreds(command.username, command.password, command.envType)
                .then((connection) => {
                    // set the url configuration, required in case of running sfdx commands with access token
                    shellJS.exec(`sfdx force:config:set instanceUrl=${connection.instanceURL} --global`);
                    return apexTestingService.getTestSubmission(apexTestingService.testLevel[command.testLevel], connection.accessToken,
                        command.directoryPath, command.testClasses, waitTime);
                })
                .then((result) => {
                    logger.debug('runApexTests.js :: ', result.result.summary);
                    // write the results to an artifact
                    apexTestingService.renameFiles(command.directoryPath, result.result.summary.testRunId, command.buildNumber);
                    return apexTestingService.checkTestCoverage(result, command.minimumPercentage || 75);
                })
                .then((result) => {
                    if(command.slackWebhookUri) {
                        return notificationService.sendSuccessMessage(command.slackWebhookUri,  result.result.summary);
                    }
                    process.exit(result.status);
                })
                .catch((error) => {
                    logger.error('runApexTests.js :: ', ' :: ', 'FAILED :: ', error);
                    // write the results to an artifact
                    if (error.result && error.result.summary && error.result.summary.testRunId) {
                        apexTestingService.renameFiles(command.directoryPath, error.result.summary.testRunId, command.buildNumber);
                    }
                    if(command.uri) {
                        notificationService.sendFailureMessage(command.slackWebhookUri,  error.result.summary);
                    }
                    process.exit(1);
                });
        } else {
            apexTestingService.getTestSubmission(apexTestingService.testLevel[command.testLevel],       command.targetusername,
                command.directoryPath, command.testClasses,
                waitTime)
                .then((result) => {
                    logger.debug('runApexTests.js :: ', result.result.summary);
                    // write the results to an artifact
                    apexTestingService.renameFiles(command.directoryPath, result.result.summary.testRunId, command.buildNumber);
                    return apexTestingService.checkTestCoverage(result, command.minimumPercentage || 75);
                })
                .then((result) => {
                    if(command.slackWebhookUri) {
                        return notificationService.sendSuccessMessage(command.uri,  result.result.summary);
                    }
                    process.exit(result.status);
                })
                .catch((error) => {
                    logger.error('runApexTests.js :: ', ' :: ', 'FAILED ', error);
                    // write the results to an artifact
                    if (error.result && error.result.summary && error.result.summary.testRunId) {
                        apexTestingService.renameFiles(command.directoryPath, error.result.summary.testRunId, command.buildNumber);
                    }
                    if(command.uri) {
                        notificationService.sendFailureMessage(command.uri,  error.result.summary);
                    }
                    process.exit(1);
                });
        }
    });

program.parse(process.argv);

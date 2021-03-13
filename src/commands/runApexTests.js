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

program
    .description('Set of commands to run test classes on Salesforce.');
program
    .command('runTests')
    .description('Runs specified test classes or levels on target org.')
    .option('-a, --targetusername <orgAlias>', 'Username/alias/access token for the target org.')
    .option('-d, --directoryPath <directoryPath>', 'The path to store result artifacts.')
    .option('-b, --buildNumber <integer>', 'Build-Id/Build-Number for uniquely identifying the test instance.')
    .option('-l, --testLevel <LOCAL_TESTS, ALL_TESTS, SPECIFIED_TESTS>', '{LOCAL_TESTS|ALL_TESTS|SPECIFIED_TESTS} Define which test level to execute.')
    .option('-n, --testClasses <apex class name>', 'A comma separated list of test classes to run. Required if --testLevel is SPECIFIED_TESTS')
    .option('-m, --minimumPercentage <integer>', '[default: 75] The minimum test coverage percentage required.')
    .option('-u, --username <username>', 'username for the target org')
    .option('-s, --password <secret>', 'password for the target org add secret token as well if the target system is not open for the ip ranges')
    .option('-t, --envType <type>', 'either SANDBOX, PRODUCTION or SCRATCH')
    .action((command) => {
        console.log(command.targetusername);
        fs.ensureDirSync(command.directoryPath);
        if (!Object.keys(apexTestingService.testLevel).includes(command.testLevel)) {
            console.error('Invalid test level defined!');
            process.exit(1);
        }
        if (!command.targetusername) {
            if (!(command.username && command.password)) {
                console.error('No JWT alias provided, so username and password are required.');
                process.exit(1);
            }
            if (!command.envType) {
                console.error('-t --envType is required with username-password based deployment');
                process.exit(1);
            }
            authenticate.loginWithCreds(command.username, command.password, command.envType)
                .then((connection) => {
                    // set the url configuration, required in case of running sfdx commands with access token
                    shellJS.exec(`sfdx force:config:set instanceUrl=${connection.instanceURL} --global`);
                    return apexTestingService.getTestSubmission(apexTestingService.testLevel[command.testLevel], connection.accessToken,
                        command.directoryPath, command.testClasses);
                })
                .then((result) => {
                    console.log('runApexTests.js :: ', result.result.summary);
                    // write the results to an artifact
                    apexTestingService.renameFiles(command.directoryPath, result.result.summary.testRunId, command.buildNumber);
                    return apexTestingService.checkTestCoverage(result, command.minimumPercentage || 75);
                })
                .then((result) => {
                    process.exit(result.status);
                })
                .catch((error) => {
                    console.error('runApexTests.js :: ', ' :: ', 'FAILED :: ', error);
                    // write the results to an artifact
                    if (error.result && error.result.summary && error.result.summary.testRunId) {
                        apexTestingService.renameFiles(command.directoryPath, error.result.summary.testRunId, command.buildNumber);
                    }
                    process.exit(error.status);
                });
        } else {
            apexTestingService.getTestSubmission(apexTestingService.testLevel[command.testLevel], command.targetusername,
                command.directoryPath, command.testClasses)
                .then((result) => {
                    console.log('runApexTests.js :: ', result.result.summary);
                    // write the results to an artifact
                    apexTestingService.renameFiles(command.directoryPath, result.result.summary.testRunId, command.buildNumber);
                    return apexTestingService.checkTestCoverage(result, command.minimumPercentage || 75);
                })
                .then((result) => {
                    process.exit(result.status);
                })
                .catch((error) => {
                    console.error('runApexTests.js :: ', ' :: ', 'FAILED ', error);
                    // write the results to an artifact
                    if (error.result && error.result.summary && error.result.summary.testRunId) {
                        apexTestingService.renameFiles(command.directoryPath, error.result.summary.testRunId, command.buildNumber);
                    }
                    process.exit(error.status);
                });
        }
    });

program.parse(process.argv);

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
const authenticate = require('./authenticate');
const errorUtil = require('./errorUtil');

const testLevel = {
  LOCAL_TESTS: 'RunLocalTests',
  ALL_TESTS: 'RunAllTestsInOrg',
  SPECIFIED_TESTS: 'RunSpecifiedTests',
  // SUITES: 'Suites', // debatable keep or not
};

/**
 * @author Groundswell - Henry Zhao - henry@gscloudsolutions.com
 * @date 2019-05-17
 *
 * @description Submits a test run and retrieves the results via SFDX command
 * @param testType - scope of test to run <RunLocalTests | RunAllTestsInOrg | RunSpecifiedTests>
 * @param alias - target organization alias to run the tests on
 * @param filePath - directory to save test results to
 * @param testClasses - only REQUIRED if testType is RunSpecifiedTests. A string of comma separated test classes to be run
 * @return Promise<JSON> - Returns a JSON of test run results, containing a status code and test results with coverage
 */
const getTestSubmission = (testType, alias, filePath, testClasses = null) => new Promise((resolve, reject) => {
  console.log('runApexTests.js :: submitting test');
  // we are not calling force:apex:test:report anymore because the flag -r json returns back with the full test result.
  // this is undocumented in the sfdx CLI, but since it works, we are making the assumption this is working by design.
  console.log('runApexTests.js ::', 'Running command ::',
    `sfdx force:apex:test:run -u ${alias} -l ${testType} -r json -d ${filePath} ${testType === testLevel.SPECIFIED_TESTS ? ` -n ${testClasses}` : ''}`);

  let submission = shellJS.exec(`sfdx force:apex:test:run -u ${alias} -l ${testType} -r json -d ${filePath} -c -w 20 ${testType === testLevel.SPECIFIED_TESTS ? `-n ${testClasses}` : ''}`,
    {
      silent: true,
    });
  if (submission.stderr !== '') {
    errorUtil.handleStderr(submission.stderr)
      .then((result) => {
        console.log('runApexTests.js :: ', result);
        reject(result);
      })
      .catch((error) => {
        console.log('runApexTests.js :: ', 'CATCH :: Unexpected error received!');
        reject(error);
      });
  } else {
    submission = JSON.parse(submission.stdout);
    console.log('runApexTests.js ::', submission.status);
    if (submission.status === 0) {
      resolve(submission);
    }
    reject(submission);
  }
});


/**
 * @author Groundswell - Henry Zhao - henry@gscloudsolutions.com
 * @date 2019-05-17
 *
 * @description Renames the local test result files so they can be sequenced correctly in artifact
 *
 * @param targetDir - directory that the test results are stored in
 * @param testRunId - the unique testRunId identifier used to specify which files to rename
 * @param buildNumber - the current build number that will be used as unique identifiers after rename
 * @return void
 */
const renameFiles = (targetDir, testRunId, buildNumber) => new Promise((resolve, reject) => {
  try {
    fs.renameSync(`${targetDir}/test-result-${testRunId}.json`, `${targetDir}/test-result-${buildNumber}.json`);
    fs.renameSync(`${targetDir}/test-result-${testRunId}-junit.xml`, `${targetDir}/test-result-${buildNumber}-junit.xml`);
    resolve();
  } catch (exception) {
    reject(exception);
  }
});

/**
 * @author Groundswell - Henry Zhao - henry@gscloudsolutions.com
 * @date 2019-05-17
 *
 * @description - Performs a check on org wide coverage and test run coverage, ensuring the percentage is above the
 * specified amount
 *
 * @param result - the return from sfdx test run command, containing status and test results
 * @param minimum - an Integer that represents the minimum acceptable test coverage amount. 75 by default
 * @return the return from sfdx test run command, if test coverage check failed, status will be changed to 1
 */
const checkTestCoverage = (result, minimum = 75) => new Promise((resolve, reject) => {
  try {
    const testCoverage = parseFloat(result.result.summary.testRunCoverage);
    const orgCoverage = parseFloat(result.result.summary.orgWideCoverage);

    if (testCoverage < minimum) {
      console.log('runApexTests.js :: ', 'checkTestCoverage :: ', `test coverage for specified tests is <${minimum}`);
      // eslint-disable-next-line no-param-reassign
      result.status = 1;
      reject(result);
    }
    if (orgCoverage < minimum) {
      console.log('runApexTests.js :: ', 'checkTestCoverage :: ', `org wide coverage is <${minimum}`);
      // eslint-disable-next-line no-param-reassign
      result.status = 1;
      reject(result);
    }
    resolve(result);
  } catch (exception) {
    reject(exception);
  }
});

program
  .description('Set of commands to run test classes on Salesforce.');
program
  .command('runTests')
  .description('Runs specified test classes or levels on target org.')
  .option('-a, --targetusername <orgAlias>', 'Username/alias/access token for the target org.')
  .option('-d, --directoryPath <path>', 'The path to store result artifacts.')
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
    if (!Object.keys(testLevel).includes(command.testLevel)) {
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
          return getTestSubmission(testLevel[command.testLevel], connection.accessToken,
            command.directoryPath, command.testClasses);
        })
        .then((result) => {
          console.log('runApexTests.js :: ', result.result.summary);
          // write the results to an artifact
          renameFiles(command.directoryPath, result.result.summary.testRunId, command.buildNumber);
          return checkTestCoverage(result, command.minimumPercentage || 75);
        })
        .then((result) => {
          process.exit(result.status);
        })
        .catch((error) => {
          console.error('runApexTests.js :: ', ' :: ', 'FAILED :: ', error);
          // write the results to an artifact
          if (error.result && error.result.summary && error.result.summary.testRunId) {
            renameFiles(command.directoryPath, error.result.summary.testRunId, command.buildNumber);
          }
          process.exit(error.status);
        });
    } else {
      getTestSubmission(testLevel[command.testLevel], command.targetusername,
        command.directoryPath, command.testClasses)
        .then((result) => {
          console.log('runApexTests.js :: ', result.result.summary);
          // write the results to an artifact
          renameFiles(command.directoryPath, result.result.summary.testRunId, command.buildNumber);
          return checkTestCoverage(result, command.minimumPercentage || 75);
        })
        .then((result) => {
          process.exit(result.status);
        })
        .catch((error) => {
          console.error('runApexTests.js :: ', ' :: ', 'FAILED ', error);
          // write the results to an artifact
          if (error.result && error.result.summary && error.result.summary.testRunId) {
            renameFiles(command.directoryPath, error.result.summary.testRunId, command.buildNumber);
          }
          process.exit(error.status);
        });
    }
  });

program.parse(process.argv);

// Export methods
module.exports = {
  getTestSubmission,
  testLevel,
};

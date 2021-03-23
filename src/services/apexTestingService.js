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
const fs = require('fs-extra');
const errorUtil = require('../utils/errorUtil');
const logger = require('../utils/logger');

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
    logger.debug('runApexTests.js :: submitting test');
    // we are not calling force:apex:test:report anymore because the flag -r json returns back with the full test result.
    // this is undocumented in the sfdx CLI, but since it works, we are making the assumption this is working by design.
    logger.debug('runApexTests.js ::', 'Running command ::',
        `sfdx force:apex:test:run -u ${alias} -l ${testType} -r json -d ${filePath} ${testType === testLevel.SPECIFIED_TESTS ? ` -n ${testClasses}` : ''}`);

    let submission = shellJS.exec(`sfdx force:apex:test:run -u ${alias} -l ${testType} -r json -d ${filePath} -c -w 20 ${testType === testLevel.SPECIFIED_TESTS ? `-n ${testClasses}` : ''}`,
        {
            silent: true,
        });
    if (submission.stderr !== '') {
        errorUtil.handleStderr(submission.stderr)
            .then((result) => {
                logger.debug('runApexTests.js :: ', result);
                reject(result);
            })
            .catch((error) => {
                logger.debug('runApexTests.js :: ', 'CATCH :: Unexpected error received!');
                reject(error);
            });
    } else {
        submission = JSON.parse(submission.stdout);
        logger.debug('runApexTests.js ::', submission.status);
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
            logger.debug('runApexTests.js :: ', 'checkTestCoverage :: ', `test coverage for specified tests is <${minimum}`);
            // eslint-disable-next-line no-param-reassign
            result.status = 1;
            reject(result);
        }
        if (orgCoverage < minimum) {
            logger.debug('runApexTests.js :: ', 'checkTestCoverage :: ', `org wide coverage is <${minimum}`);
            // eslint-disable-next-line no-param-reassign
            result.status = 1;
            reject(result);
        }
        resolve(result);
    } catch (exception) {
        reject(exception);
    }
});

// Export methods
module.exports = {
    getTestSubmission,
    renameFiles,
    checkTestCoverage,
    testLevel,
};
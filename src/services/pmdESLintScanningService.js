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

const shellJS = require("shelljs");
const type = require("type-detect");

const logger = require("../utils/logger");
const notificationService = require("./scaSlackNotifService");

const severitySummary = {};

const isStaticCodeAnalysisFailed = () => {
    logger.debug("severitySummary.one: ", severitySummary.one);
    return severitySummary.one > 0;
};

const beautifyForConsole = (transformedResults, summaryMessage) => {
    let beautifiedMessage =
        "############################## Static Code Analysis Results ################################".rainbow;
    beautifiedMessage += `\n${summaryMessage}`;
    transformedResults.forEach((result) => {
        let severity = "";
        let fileName = "";
        if (result.severity == "1") {
            severity = `${"Severity".bold}: ${result.severity}`.red;
            fileName = `${"File Name".bold}: ${result.fileName}`.red;
        } else if (result.severity == "2") {
            severity = `${"Severity".bold}: ${result.severity}`.magenta;
            fileName = `${"File Name".bold}: ${result.fileName}`.magenta;
        } else if (result.severity == "3") {
            severity = `${"Severity".bold}: ${result.severity}`.yellow;
            fileName = `${"File Name".bold}: ${result.fileName}`.yellow;
        } else if (result.severity == "4") {
            severity = `${"Severity".bold}: ${result.severity}`.cyan;
            fileName = `${"File Name".bold}: ${result.fileName}`.cyan;
        } else {
            severity = `${"Severity".bold}: ${result.severity}`;
            fileName = `${"File Name".bold}: ${result.fileName}`;
        }
        beautifiedMessage += `\n-----------------------------------------------------
${fileName}
${severity}
${"Line Number".bold}: ${result.line}
${"Column".bold}: ${result.column}
${"Rule Name".bold}: ${result.ruleName}
${"Message".bold}: ${result.message.replace("\n", "").trim()}`;
    });
    return beautifiedMessage;
};

const createSummary = () => {
    return `
${"***************************** Summary *************************".bgCyan["black"]}
${"Severity 1 Violations(Critical)".bold.red}:  ${severitySummary.one}
${"Severity 2 Violations".bold.magenta}: ${severitySummary.two}
${"Severity 3 Violations".bold.yellow}: ${severitySummary.three}
${"Severity 4 Violations".bold.cyan}: ${severitySummary.four}
${"Severity 5 Violations".bold} : ${severitySummary.five}`;
};

const transformAndSortBySeverity = (results) => {
    let transformedResults = [];
    const severityOneResults = [];
    const severityTwoResults = [];
    const severityThreeResults = [];
    const severityFourResults = [];
    const severityFiveResults = [];
    if (results && type(results) === "Array") {
        results.forEach((result) => {
            logger.trace(result);
            if (result.violations) {
                result.violations.forEach((violation) => {
                    switch (violation.severity) {
                        case 1:
                        case "1":
                            severityOneResults.push(
                                new transformedRow(
                                    result.fileName,
                                    violation.line,
                                    violation.column,
                                    violation.ruleName,
                                    violation.message,
                                    violation.severity
                                )
                            );
                            break;
                        case 2:
                        case "2":
                            severityTwoResults.push(
                                new transformedRow(
                                    result.fileName,
                                    violation.line,
                                    violation.column,
                                    violation.ruleName,
                                    violation.message,
                                    violation.severity
                                )
                            );
                            break;
                        case 3:
                        case "3":
                            severityThreeResults.push(
                                new transformedRow(
                                    result.fileName,
                                    violation.line,
                                    violation.column,
                                    violation.ruleName,
                                    violation.message,
                                    violation.severity
                                )
                            );
                            break;
                        case 4:
                        case "4":
                            severityFourResults.push(
                                new transformedRow(
                                    result.fileName,
                                    violation.line,
                                    violation.column,
                                    violation.ruleName,
                                    violation.message,
                                    violation.severity
                                )
                            );
                            break;
                        default:
                            severityFiveResults.push(
                                new transformedRow(
                                    result.fileName,
                                    violation.line,
                                    violation.column,
                                    violation.ruleName,
                                    violation.message,
                                    violation.severity
                                )
                            );
                    }
                });
            }
        });
    } else if (results) {
        logger.info(results);
    }

    transformedResults = [
        ...severityOneResults,
        ...severityTwoResults,
        ...severityThreeResults,
        ...severityFourResults,
        ...severityFiveResults,
    ];

    severitySummary.one = severityOneResults.length;
    logger.debug(severitySummary.one);
    severitySummary.two = severityTwoResults.length;
    logger.debug(severitySummary.two);
    severitySummary.three = severityThreeResults.length;
    logger.debug(severitySummary.three);
    severitySummary.four = severityFourResults.length;
    logger.debug(severitySummary.four);
    severitySummary.five = severityFiveResults.length;
    logger.debug(severitySummary.five);
    severitySummary.total = transformedResults.length;
    logger.debug(severitySummary.total);

    return transformedResults;
};

// Constructor function
function transformedRow(fileName, line, column, ruleName, message, severity) {
    this.fileName = fileName.trim();
    this.line = line;
    this.column = column;
    this.ruleName = ruleName;
    this.message = message;
    this.severity = severity;
    this.isCritical = false;
    if (severity <= 1) {
        this.isCritical = true;
    }
}

const scan = async (targetPathforScanning, pmdConfigPath, eslintConfigPath, SLACK_WEBHOOK_URI, NOTIF_TITLE) => {
    const baseCommand = `sfdx scanner:run --target ${targetPathforScanning}  --format json --json`;
    const pmdConfig = pmdConfigPath ? ` --pmdconfig ${pmdConfigPath}` : "";
    const eslintConfig = eslintConfigPath ? ` --eslintconfig ${eslintConfigPath}` : "";
    const fullCommand = `${baseCommand}${pmdConfig}${eslintConfig}`;
    logger.debug(fullCommand);
    const scanningResultsJSON = shellJS.exec(fullCommand, { silent: true }).stdout;
    logger.trace("scanningResultsJSON: ", scanningResultsJSON);
    const scanningResults = JSON.parse(scanningResultsJSON);
    logger.trace("scanningResults: ", scanningResults);
    logger.trace(scanningResults.result);
    // Evaluate SCA results and log them nicely:
    //logger.debug('scanningResults', scanningResults);
    const transformedResults = transformAndSortBySeverity(scanningResults.result);
    const beautifiedResults = beautifyForConsole(transformedResults, createSummary());
    console.log(beautifiedResults); // To log beautified results
    logger.debug("After beautified results");
    const isSCAFailed = isStaticCodeAnalysisFailed();
    // TODO: Generate HTML report
    // Send Slack notification
    if (SLACK_WEBHOOK_URI) {
        if (isSCAFailed) {
            await notificationService.sendFailureMessage(SLACK_WEBHOOK_URI, severitySummary, NOTIF_TITLE);
        } else {
            await notificationService.sendSuccessMessage(SLACK_WEBHOOK_URI, severitySummary, NOTIF_TITLE);
        }
    }
    return isSCAFailed;
};

module.exports = {
    scan,
};

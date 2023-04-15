const colors = require("colors");
const type = require("type-detect");

const castArray = require("../utils/utils").castArray;
const logger = require("../utils/logger");

function transformAndBeautifyFailureResults(outputJSON) {
    if (!outputJSON || outputJSON?.result?.success) {
        return "";
    }

    const beautifiedMsg = [
        "*******************************   Deployment failed    ***********************************".bgRed.black,
    ];

    const executionResults = outputJSON.result?.details || outputJSON.details || {};

    // Components Failures
    const componentFailures = executionResults.componentFailures || [];
    if (componentFailures.length) {
        beautifiedMsg.push(`\n Total Component Deployment Failures: ${componentFailures.length}`.red);

        for (const cmp of componentFailures) {
            beautifiedMsg.push("----------------------------------------------------------------");
            beautifiedMsg.push(`${"Full Name".bold}: ${cmp.fullName}`);
            beautifiedMsg.push(`${"Type".bold}: ${cmp.componentType}`);
            beautifiedMsg.push(`${"Line Number".bold}: ${cmp.lineNumber}`);
            beautifiedMsg.push(`${"Error Message".bold}: ${cmp.problem}\n`);
        }
    } else {
        beautifiedMsg.push("\n Total Component Deployment Failures: 0".green);
    }

    // Test Results
    const testFailures = executionResults.runTestResult?.failures || [];
    if (testFailures.length) {
        beautifiedMsg.push(`\n Total Test Class Failures: ${testFailures.length}`.red);

        for (const cmp of testFailures) {
            beautifiedMsg.push("----------------------------------------------------------------");
            beautifiedMsg.push(`${"Component Name".bold}: ${cmp.name}`);
            beautifiedMsg.push(`${"Method Name".bold}: ${cmp.methodName}`);
            beautifiedMsg.push(`${"Type".bold}: ${cmp.type}`);
            beautifiedMsg.push(`${"Error Message".bold.red}: ${cmp.message.red}`);
            beautifiedMsg.push(`${"Stack Trace".bold.red}: ${cmp.stackTrace.red}\n`);
        }
    } else {
        beautifiedMsg.push("\n Total Test Class Failures: 0".green);
    }

    // Coverage warnings
    const codeCoverageWarnings = castArray(executionResults.runTestResult?.codeCoverageWarnings);
    if (codeCoverageWarnings.length) {
        beautifiedMsg.push(
            "******************************* Code Coverage Warnings ***********************************".bgYellow.black
        );

        codeCoverageWarnings.forEach((cmp) => {
            beautifiedMsg.push("----------------------------------------------------------------");
            if (type(cmp.name).toLocaleLowerCase() === "string") {
                beautifiedMsg.push(`${"Component Name".bold}: ${cmp.name}`);
            }

            beautifiedMsg.push(`${"Error Message".bold.yellow}: ${cmp.message.yellow}\n`);
        });
    }

    return beautifiedMsg.join("\n");
}

module.exports = {
    transformAndBeautifyFailureResults,
};

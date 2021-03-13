const colors = require('colors');
const type = require('type-detect');
const logger = require('../utils/logger');

const transformAndBeautifyFailureResults = (outputJSON) => {
    logger.debug(outputJSON);
    let beautifiedMsg = ('***************************** Deployment failed ********************************'.bgRed).black;
    if (outputJSON && outputJSON.result && outputJSON.result.details && outputJSON.result.details.componentFailures) {
        let message = `\n Total Component Deployment Failures: ${outputJSON.result.details.componentFailures.length}`;
        beautifiedMsg += message.red;
        
        for (const cmp of outputJSON.result.details.componentFailures) {
            beautifiedMsg += 
`\n----------------------------------------------------------------
${'Full Name'.bold}: ${cmp.fullName}
${'Type'.bold}: ${cmp.componentType}
${'Line Number'.bold}: ${cmp.lineNumber}
${'Error Message'.bold}: ${cmp.problem}\n`
        
        }
    } else {
        let message = `\n Total Component Deployment Failures: 0`;
        beautifiedMsg += message.green;
    }

    // Parsing test result failures
    if (outputJSON && 
        outputJSON.result && 
        outputJSON.result.details && 
        outputJSON.result.details.runTestResult && 
        outputJSON.result.details.runTestResult.failures) {
        let message = `\n Total Test Class Failures: ${outputJSON.result.details.runTestResult.failures.length}`;
        beautifiedMsg += message.red;
        for (const cmp of outputJSON.result.details.runTestResult.failures) {
            beautifiedMsg += 
`\n----------------------------------------------------------------
${'Component Name'.bold}: ${cmp.name}
${'Method Name'.bold}: ${cmp.methodName}
${'Type'.bold}: ${cmp.type}
${('Error Message'.bold).red}: ${(cmp.message).red}
${('Stack Trace'.bold).red}: ${(cmp.stackTrace).red}\n`;
        }     
    } else {
        let message = `\n Total Test Class Failures: 0`;
        beautifiedMsg += message.green;
    }

    // Parsing test result code coverage warnings
    if (outputJSON && 
        outputJSON.result && 
        outputJSON.result.details && 
        outputJSON.result.details.runTestResult && outputJSON.result.details.runTestResult.codeCoverageWarnings) {
        beautifiedMsg += ('******************************* Code Coverage Warnings ***********************************'.bgYellow).black;
        if (type(outputJSON.result.details.runTestResult.codeCoverageWarnings) === 'Array') {
            
            outputJSON.result.details.runTestResult.codeCoverageWarnings.forEach((cmp) => {
                if(type(cmp.name) === 'string' || type(cmp.name) === 'String') {
                    beautifiedMsg +=
`\n----------------------------------------------------------------
${'Component Name'.bold}: ${cmp.name}
${('Error Message'.bold).yellow}: ${(cmp.message).yellow}`;
                } else {
                    beautifiedMsg +=
`\n----------------------------------------------------------------
${('Error Message'.bold).yellow}: ${(cmp.message).yellow}`;
                }
            });
        } else {
            const cmp = outputJSON.result.details.runTestResult.codeCoverageWarnings;
            if(type(cmp.name) === 'string' || type(cmp.name) === 'String') {
                beautifiedMsg +=
`\n----------------------------------------------------------------
${'Component Name'.bold}: ${cmp.name}
${('Error Message'.bold).yellow}: ${(cmp.message).yellow}`;
            } else {
                beautifiedMsg +=
`\n----------------------------------------------------------------
${('Error Message'.bold).yellow}: ${(cmp.message).yellow}`;
            }
        }
    }

    return beautifiedMsg;
}

module.exports = {
    transformAndBeautifyFailureResults
}
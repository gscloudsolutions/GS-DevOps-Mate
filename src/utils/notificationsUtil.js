const axios = require('axios');
const type = require('type-detect');

const logger = require('./logger');
const castArray = require('./utils').castArray;
const ciCDProviderMessaging = require('./cICDProviderSpecificMessaging').ciCDSpecificMessaging;

const NO_CODE_COVERAGE_INFO = 'No Code Coverage Info';

const ciCDProvider = process.env.CI_CD_PROVIDER;
const SLACK_MESSAGES = process.env.SLACK_MESSAGES || 'off';
const SUCCESS_EMOJI_1 = process.env.SUCCESS_EMOJI_1 || ':tada:';
const SUCCESS_EMOJI_2 = process.env.SUCCESS_EMOJI_2 || ':trophy:';
const FAILURE_EMOJI = process.env.FAILURE_EMOJI || ':fire:';

const createProviderSpecificMessage = (buildInfo) => {
    let buildMessage = '';
    const buildURL = buildInfo.BuildResultsURL ? buildInfo.BuildResultsURL : '';
    buildMessage += buildInfo.BuildName ? `\n Build Name: <${buildURL}|${buildInfo.BuildName}>` : '';
    buildMessage += buildInfo.BuildReason || buildInfo.BuildAuthorName ? `\n${buildInfo.BuildReason} Run by: ${buildInfo.BuildAuthorName}` : '';
    buildMessage += buildInfo.BuildSourceBranch ? `\n Source Branch: <${buildInfo.BuildSourceBranchURL}|${buildInfo.BuildSourceBranch}>` : '';
    buildMessage += buildInfo.ArtifactPath ? `\n Artifact can be found <${buildInfo.ArtifactPath}|here>` : '';
    return buildMessage;
};

const generateCommonMessage = async (title, titleStartEmoji, titleEndEmoji) => {
    const blocks = [];

    let buildMessage = '';
    const buildInfo = await ciCDProviderMessaging[ciCDProvider].getBuildInfo();
    if (buildInfo) {
        buildMessage = createProviderSpecificMessage(buildInfo);
    }

    if (buildInfo.BuildAuthorAvatar) {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*:${titleStartEmoji}: ${title} :${titleEndEmoji}::* ${buildMessage}`,
            },
            accessory: {
                type: 'image',
                image_url: buildInfo.BuildAuthorAvatar,
                alt_text: 'Build Triggered By',
            },
        });
    } else {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*:${titleStartEmoji}: ${title} :${titleEndEmoji}::*  ${buildMessage}`,
            },
        });
    }
    return blocks;
}

const generateFinalMessage = async (summary, title, messagePrepFn, startEmoji, endEmoji) => {
    let blocks = await generateCommonMessage( 
        title,
        startEmoji,
        endEmoji
    );
    let finalBlocks = await messagePrepFn(blocks, summary);

    logger.debug('finalBlocks: ', finalBlocks);
    let slackMessage = {};
    slackMessage.blocks = finalBlocks
    return slackMessage;
}

const calculateOverallCodeCoverage = (outputJSON, minCoverage = 75) => {
    const executionResults = outputJSON.result?.details || outputJSON.details || {};

    let totalNumLocations = 0;
    let totalNumLocationsNotCovered = 0;
    const cmpsWithLessCodeCoverage = [];
    
    castArray(executionResults.runTestResult.codeCoverage).forEach((cmp) => {
        if (cmp.numLocations <= 0) {
            return;
        }

        logger.debug('cmp.numLocations: ', cmp.numLocations);
        logger.debug('cmp.numLocationsNotCovered: ', cmp.numLocationsNotCovered);

        totalNumLocations += parseInt(cmp.numLocations);
        totalNumLocationsNotCovered += parseInt(cmp.numLocationsNotCovered);
        const codeCoverage = parseInt((((parseInt(cmp.numLocations) - parseInt(cmp.numLocationsNotCovered)) / parseInt(cmp.numLocations)) * 100).toFixed(2));
        logger.debug(`codeCoverage for ${cmp}`, codeCoverage);
        
        if (codeCoverage < minCoverage) {
            cmpsWithLessCodeCoverage.push({ name: cmp.name, type: cmp.type, coverage: codeCoverage });
        }

        logger.debug('totalNumLocations: ', totalNumLocations);
        logger.debug('totalNumLocationsNotCovered: ', totalNumLocationsNotCovered);
    });
    
    logger.debug('totalNumLocations: ', totalNumLocations);
    logger.debug('totalNumLocationsNotCovered: ', totalNumLocationsNotCovered);
    logger.debug('cmpsWithLessCodeCoverage: ', cmpsWithLessCodeCoverage);
    
    if (totalNumLocations > 0) {
        return {
            overallBuildCodeCoverage: (((totalNumLocations - totalNumLocationsNotCovered) / totalNumLocations)
                * 100).toFixed(2),
            cmpsWithLessCodeCoverage,
        };
    }
    return NO_CODE_COVERAGE_INFO;
};

const createFailureNotificationForSlack = (stdout, minCodeCoveragePerCmp = 75, codeCoverageResult, isValidation, buildInfo, notificationTitle) => {
    const executionResults = stdout?.result?.details || stdout?.details || {};

    const validation = (isValidation === true || isValidation === 'true') ? 'validation' : '';
    const title = notificationTitle ? `${notificationTitle} Failed` : `Build ${validation} Failed`;

    const blocks = [];

    let buildMessage = '';
    if (buildInfo) {
        buildMessage = createProviderSpecificMessage(buildInfo);
    }

    if (buildInfo.BuildAuthorAvatar) {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*${FAILURE_EMOJI} ${title}* due to following reasons: ${buildMessage}`,
            },
            accessory: {
                type: 'image',
                image_url: buildInfo.BuildAuthorAvatar,
                alt_text: 'Build Triggered By',
            },
        });
    } else {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*${FAILURE_EMOJI} ${title}* due to following reasons: ${buildMessage}`,
            },
        });
    }

    if (executionResults.componentFailures) {
        const componentFailures = castArray(executionResults.componentFailures);
        blocks.push(
            {
                type: 'divider',
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `:red_circle: *Total failures*: ${componentFailures.length}`,
                },
            },
        );
        let cmpsCounter = 1;

        for (const cmp of componentFailures) {
            if (cmpsCounter <= 10) {
                blocks.push({
                    type: 'divider',
                });
                blocks.push({
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `${cmpsCounter}. ${cmp.componentType}: *${cmp.fullName}*  \n_Line Number_: ${cmp.lineNumber}\n Error: ${cmp.problem}:exclamation:`,
                    },
                });
            }
            if (cmpsCounter === 11) {
                blocks.push({
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: 'Please check the build for more errors',
                    },
                });
                break;
            }
            // eslint-disable-next-line no-plusplus
            cmpsCounter++;
        }
    }

    // Parsing test result failures
    if (executionResults.runTestResult?.failures) {
        blocks.push(
            {
                type: 'divider',
            },
        );
        let cmpsCounter = 1;
        for (const cmp of castArray(executionResults.runTestResult.failures)) {
            if (cmpsCounter <= 10) {
                blocks.push(
                    {
                        type: 'divider',
                    },
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `${cmpsCounter}. _Component Name_: ${cmp.name} \n _Method_: ${cmp.methodName} \n _Type_: ${cmp.type} \n _Error Message_: ${cmp.message}`,
                        },
                    },
                );
            }
            if (cmpsCounter === 11) {
                blocks.push({
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: 'Please check the build for more errors',
                    },
                });
                break;
            }
            // eslint-disable-next-line no-plusplus
            cmpsCounter++;
        }
    }

    // Parsing test result code coverage warnings
    if (executionResults.runTestResult?.codeCoverageWarnings) {
        blocks.push(
            {
                type: 'divider',
            },
        );
        let cmpsCounter = 1;
        castArray(executionResults.runTestResult.codeCoverageWarnings).forEach((cmp) => {
            blocks.push(
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `${cmpsCounter}. _Component Name_: ${cmp.name} \n _Message_: ${cmp.message}`,
                    },
                },
                {
                    type: 'divider',
                },
            );
            // eslint-disable-next-line no-plusplus
            cmpsCounter++;
        });
    }

    // Parsing code coverage results in case of no failures
    const result = codeCoverageResult;
    logger.debug('code coverage result: ', result);
    if (result !== NO_CODE_COVERAGE_INFO) {
        blocks.push(
            {
                type: 'divider',
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `Overall Code Coverage of this build is: ${result.overallBuildCodeCoverage}%`,
                },
            },
        );
        if (result.cmpsWithLessCodeCoverage.length > 0) {
            blocks.push(
                {
                    type: 'divider',
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `Following components have less than : ${minCodeCoveragePerCmp}% code coverage`,
                    },
                },
            );
            let cmpsCounter = 1;
            result.cmpsWithLessCodeCoverage.forEach((cmp) => {
                if(cmpsCounter <= 10) {
                    blocks.push(
                        {
                            type: 'divider',
                        },
                        {
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: `${cmpsCounter}. ${cmp.type}: *${cmp.name}*  Code Coverage: ${cmp.coverage}%`,
                            },
                        },
                    );
                    // eslint-disable-next-line no-plusplus
                    
                }
                cmpsCounter++;
                
            });
        }
    }

    return {
        blocks,
    };
};

// eslint-disable-next-line max-len
const generateFailureNotificationForSlack = 
async (stdout, minCodeCoveragePerCmp = 75, 
    codeCoverageResult, 
    isValidation, 
    notificationTitle) => 
    ciCDProviderMessaging[ciCDProvider].getBuildInfo()
    .then(buildInfo => createFailureNotificationForSlack(stdout, 
        minCodeCoveragePerCmp = 75, 
        codeCoverageResult, 
        isValidation, 
        buildInfo, 
        notificationTitle)
    );

const createSuccessNotificationForSlack = (codeCoverageResult, isValidation, buildInfo, notificationTitle) => {
    logger.debug(buildInfo);
    const validation = (isValidation === true || isValidation === 'true') ? 'validation' : '';
    const title = notificationTitle ? `${notificationTitle} Successful` : `Build ${validation} Successful`;
    let buildMessage = '';
    if (buildInfo) {
        buildMessage = createProviderSpecificMessage(buildInfo);
    }
    logger.debug('buildMessage: ', buildMessage);
    const blocks = [];


    if (buildInfo.BuildAuthorAvatar) {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*${SUCCESS_EMOJI_1} ${title}*  ${SUCCESS_EMOJI_2}  ${buildMessage}`,
            },
            accessory: {
                type: 'image',
                image_url: buildInfo.BuildAuthorAvatar,
                alt_text: 'Build Triggered By',
            },
        });
    } else {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*${SUCCESS_EMOJI_1} ${title}*  ${SUCCESS_EMOJI_2}  ${buildMessage}`,
            },
        });
    }

    const result = codeCoverageResult;
    logger.debug('code coverage result: ', result);
    if (result !== NO_CODE_COVERAGE_INFO) {
        blocks.push(
            {
                type: 'divider',
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `Overall Code Coverage of this build is: *${result.overallBuildCodeCoverage}%*, Great Job!!`,
                },
            },
        );
    }

    return {
        blocks,
    };
};

// eslint-disable-next-line max-len
const generateSuccessNotificationForSlack = async (codeCoverageResult, isValidation, notificationTitle) => ciCDProviderMessaging[ciCDProvider].getBuildInfo().then(buildInfo => createSuccessNotificationForSlack(codeCoverageResult, isValidation, buildInfo, notificationTitle));

const createNoDiffMessage = (buildInfo, notificationTitle) => {
    const blocks = [];

    let buildMessage = '';
    const title = notificationTitle || 'Build Notification';
    if (buildInfo) {
        buildMessage = createProviderSpecificMessage(buildInfo);
    }

    if (buildInfo.BuildAuthorAvatar) {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*:loudspeaker: ${title}:* There is no Salesforce deployable package in this build  ${buildMessage}`,
            },
            accessory: {
                type: 'image',
                image_url: buildInfo.BuildAuthorAvatar,
                alt_text: 'Build Triggered By',
            },
        });
    } else {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*:loudspeaker: ${title}:* There is no Salesforce deployable package in this build  ${buildMessage}`,
            },
        });
    }

    blocks.push({
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: 'It can be either there are only non-deployable assets being part of the build like README.md or if that is not the reason, '
                    + 'please check build logs for details',
        },
    });

    logger.debug('blocks: ', blocks);
    return {
        blocks,
    };
};

const generateNoDiffMessage = async notificationTitle => ciCDProviderMessaging[ciCDProvider].getBuildInfo().then(buildInfo => createNoDiffMessage(buildInfo, notificationTitle));

// TODO: This is async, need to handle properly in files calling this method
const sendNotificationToSlack = (webhook, data) => {
    if (webhook && SLACK_MESSAGES === 'on') {
        return axios({
            method: 'post',
            url: webhook,
            headers: { 'Content-type': 'application/json' },
            data,
        });
    }
    return 'Either Slack Notification are turned off or a webhook URL is not provided';
};

// Export methods
module.exports = {
    generateCommonMessage,
    generateFinalMessage,
    calculateOverallCodeCoverage,
    generateFailureNotificationForSlack,
    generateSuccessNotificationForSlack,
    sendNotificationToSlack,
    generateNoDiffMessage,
    createProviderSpecificMessage,
};

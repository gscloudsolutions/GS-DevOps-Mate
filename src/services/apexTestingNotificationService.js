const notify = require('../utils/notificationsUtil');
const logger = require('../utils/logger');
const ciCDProviderMessaging = require('../utils/cICDProviderSpecificMessaging').ciCDSpecificMessaging;

const ciCDProvider = process.env.CI_CD_PROVIDER;

const generateCommonMessage = async (title, emoji, summary) => {
    const blocks = [];

    let buildMessage = '';
    const buildInfo = await ciCDProviderMessaging[ciCDProvider].getBuildInfo();
    if (buildInfo) {
        buildMessage = notify.createProviderSpecificMessage(buildInfo);
    }

    if (buildInfo.BuildAuthorAvatar) {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*:ladybug: ${title} :${emoji}::* ${buildMessage}`,
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
                text: `*:ladybug: ${title} :${emoji}::*  ${buildMessage}`,
            },
        });
    }

    blocks.push({
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: `Tests Ran: ${summary.testsRan}
Passing: ${summary.passing}
Failing: ${summary.failing}
Skipped: ${summary.skipped}
Pass Rate: ${summary.passRate}
Fail Rate: ${summary.failRate}
Test Total Time: ${summary.testTotalTime}
Test Run Coverage: ${summary.testRunCoverage}
Org Wide Coverage: ${summary.orgWideCoverage}`
        },
    });

    return blocks;
}

const generateSuccessMessage = async (summary, notifTitle) => {
    const title = notifTitle || 'Apex Test Class Run Results : Success'
    let blocks = await generateCommonMessage( 
        title,
        'pass',
        summary
    );

    logger.debug('blocks: ', blocks);
    return {
        blocks,
    };
}


const generateFailureMessage = async (summary, notifTitle) => {
    const title = notifTitle || 'Apex Test Class Run Results : Failed'
    let blocks = await generateCommonMessage( 
        title,
        'fail',
        summary
    );

    logger.debug('blocks: ', blocks);
    return {
        blocks,
    };
}

const sendFailureMessage = async (uri, summary, notifTitle) => {
    const message = await generateFailureMessage(summary, notifTitle);
    await notify.sendNotificationToSlack(uri, message);
    process.exit(1);
}

const sendSuccessMessage = async (uri, summary, notifTitle) => {
    const message = await generateSuccessMessage(summary, notifTitle);
    await notify.sendNotificationToSlack(uri, message);
    process.exit(0);
}

module.exports = {
    sendFailureMessage,
    sendSuccessMessage
}
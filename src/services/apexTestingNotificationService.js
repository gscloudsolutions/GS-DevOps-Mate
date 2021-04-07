const notify = require('../utils/notificationsUtil');
const ciCDProviderMessaging = require('../utils/cICDProviderSpecificMessaging').ciCDSpecificMessaging;

const ciCDProvider = process.env.CI_CD_PROVIDER;

const generateCommonMessage = async (title, emoji) => {
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
                text: `*:${emoji}: ${title}:* ${buildMessage}`,
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
                text: `*:ladybug: ${title}:*  ${buildMessage}`,
            },
        });
    }

    return blocks;
}

const generateSuccessMessage = async (summary) => {
    
    let blocks = await generateCommonMessage(buildInfo, 
        'Apex Test Class Run Results : Success',
        'ladybug'
    );

    blocks.push({
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: summary
        },
    });

    logger.debug('blocks: ', blocks);
    return {
        blocks,
    };
}


const generateFailureMessage = async (summary) => {

    let blocks = await generateCommonMessage(buildInfo, 
        'Apex Test Class Run Results : Failed',
        'fail'
    );

    blocks.push({
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: summary
        },
    });

    logger.debug('blocks: ', blocks);
    return {
        blocks,
    };
}

const sendFailureMessage = async (uri, summary) => {
    const message = await generateSuccessMessage(summary);
    await notify.sendNotificationToSlack(uri, message);
}

const sendSuccessMessage = async (uri, summary) => {
    const message = await generateFailureMessage(summary);
    await notify.sendNotificationToSlack(uri, message);
}

module.exports = {
    sendFailureMessage,
    sendSuccessMessage
}
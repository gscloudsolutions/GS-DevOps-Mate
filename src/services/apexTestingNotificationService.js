const notify = require('../utils/notificationsUtil');

const generateSuccessMessage = (summary, buildInfo) => {
    const blocks = [];

    let buildMessage = '';
    const title = 'Apex Test Class Run Results';
    if (buildInfo) {
        buildMessage = notify.createProviderSpecificMessage(buildInfo);
    }

    if (buildInfo.BuildAuthorAvatar) {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*:loudspeaker: ${title}:* ${buildMessage}`,
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

const generateFailureMessage = (summary) => {

}

const sendFailureMessage = () => {

}

const sendSuccessMessage = ()=> {

}
const notify = require('../utils/notificationsUtil');
const logger = require('../utils/logger');
// const ciCDProviderMessaging = require('../utils/cICDProviderSpecificMessaging').ciCDSpecificMessaging;

// const ciCDProvider = process.env.CI_CD_PROVIDER;

const prepareFinalMessage = async (blocks, summary) => {
    blocks.push({
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: `Severity 1 Violations(Critical): ${summary.one}
Severity 2 Violations: ${summary.two}
Severity 3 Violations: ${summary.three}
Severity 4 Violations: ${summary.four}
Severity 5 Violations: ${summary.five}
Total Violations: ${summary.total}`
        },
    });

    return blocks;
}

const generateSuccessMessage = async (summary, notifTitle) => {
    const title = notifTitle || 'Static Code Analysis Results:'
    return await notify.generateFinalMessage(summary, 
        title, 
        prepareFinalMessage,
        'in-code-review',
        'ok'
    );
}

const generateFailureMessage = async (summary, notifTitle) => {
    const title = notifTitle || 'Static Code Analysis Results:'
    return await notify.generateFinalMessage(summary, 
        title, 
        prepareFinalMessage,
        'in-code-review',
        'fail'
    );
}

const sendFailureMessage = async (uri, summary, notifTitle) => {
    const message = await generateFailureMessage(summary, notifTitle);
    await notify.sendNotificationToSlack(uri, message);
    process.exit(1);
}

const sendSuccessMessage = async (uri, summary, notifTitle) => {
    const message = await generateSuccessMessage(summary, notifTitle);
    await notify.sendNotificationToSlack(uri, message);
}

module.exports = {
    sendFailureMessage,
    sendSuccessMessage
}
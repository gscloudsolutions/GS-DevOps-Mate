import { generateFinalMessage, sendNotificationToSlack } from "../utils/notificationsUtil";

const prepareFinalMessage = async (blocks, summary) => {
    blocks.push({
        type: "section",
        text: {
            type: "mrkdwn",
            text: `Severity 1 Violations(Critical): ${summary.one}
Severity 2 Violations: ${summary.two}
Severity 3 Violations: ${summary.three}
Severity 4 Violations: ${summary.four}
Severity 5 Violations: ${summary.five}
Total Violations: ${summary.total}`,
        },
    });

    return blocks;
};

async function generateSuccessMessage(summary, notifTitle) {
    return await generateFinalMessage(summary, notifTitle, prepareFinalMessage, "in-code-review", "ok");
}

async function generateFailureMessage(summary, notifTitle) {
    return await generateFinalMessage(summary, notifTitle, prepareFinalMessage, "in-code-review", "fail");
}

export async function sendFailureMessage(uri, summary, notifTitle = "") {
    const message = await generateFailureMessage(summary, notifTitle);
    await sendNotificationToSlack(uri, message);
    process.exit(1);
}

export async function sendSuccessMessage(uri, summary, notifTitle = "") {
    const message = await generateSuccessMessage(summary, notifTitle);
    await sendNotificationToSlack(uri, message);
}

module.exports = {
    sendFailureMessage,
    sendSuccessMessage,
};

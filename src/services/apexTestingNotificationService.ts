import logger from "../utils/logger";
import ciCDProviderMessaging from "../utils/cICDProviderSpecificMessaging";
import { createProviderSpecificMessage, sendNotificationToSlack } from "../utils/notificationsUtil";

// FIXME: What is proc?
const ciCDProvider = null; //proc;

async function generateCommonMessage(title, emoji, summary) {
    const blocks = [];

    let buildMessage = "";
    const buildInfo = await ciCDProviderMessaging[ciCDProvider].getBuildInfo();
    if (buildInfo) {
        buildMessage = createProviderSpecificMessage(buildInfo);
    }

    if (buildInfo.BuildAuthorAvatar) {
        blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*:ladybug: ${title} :${emoji}::* ${buildMessage}`,
            },
            accessory: {
                type: "image",
                image_url: buildInfo.BuildAuthorAvatar,
                alt_text: "Build Triggered By",
            },
        });
    } else {
        blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*:ladybug: ${title} :${emoji}::*  ${buildMessage}`,
            },
        });
    }

    blocks.push({
        type: "section",
        text: {
            type: "mrkdwn",
            text: `Tests Ran: ${summary.testsRan}
Passing: ${summary.passing}
Failing: ${summary.failing}
Skipped: ${summary.skipped}
Pass Rate: ${summary.passRate}
Fail Rate: ${summary.failRate}
Test Total Time: ${summary.testTotalTime}
Test Run Coverage: ${summary.testRunCoverage}
Org Wide Coverage: ${summary.orgWideCoverage}`,
        },
    });

    return blocks;
}

async function generateSuccessMessage(summary, notifTitle) {
    const title = notifTitle || "Apex Test Class Run Results : Success";
    const blocks = await generateCommonMessage(title, "pass", summary);

    logger.debug("blocks: ", blocks);
    return {
        blocks,
    };
}

async function generateFailureMessage(summary, notifTitle) {
    const title = notifTitle || "Apex Test Class Run Results : Failed";
    const blocks = await generateCommonMessage(title, "fail", summary);

    logger.debug("blocks: ", blocks);
    return {
        blocks,
    };
}

export async function sendFailureMessage(uri, summary, notifTitle = "") {
    const message = await generateFailureMessage(summary, notifTitle);
    await sendNotificationToSlack(uri, message);
    process.exit(1);
}

export async function sendSuccessMessage(uri, summary, notifTitle = "") {
    const message = await generateSuccessMessage(summary, notifTitle);
    await sendNotificationToSlack(uri, message);
    process.exit(0);
}

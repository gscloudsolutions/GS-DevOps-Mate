import logger from "../utils/logger";
import ciCDProviderMessaging from "../utils/cICDProviderSpecificMessaging";
import { createProviderSpecificMessage, sendNotificationToSlack } from "../utils/notificationsUtil";

const ciCDProvider = process.env.CI_CD_PROVIDER;

const generatePackageCreationFailureMessage = async (title, summary) => {
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
                text: `*:package: ${title} :FAIL::* ${buildMessage}`,
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
                text: `*:package: ${title} :FAIL::*  ${buildMessage}`,
            },
        });
    }

    blocks.push({
        type: "section",
        text: {
            type: "mrkdwn",
            text: `Failed due to following reason: 
${summary}`,
        },
    });

    return {
        blocks,
    };
};

const sendFailureMessage = async (uri, summary, notifTitle = "Package Creation Status: ") => {
    const message = await generatePackageCreationFailureMessage(notifTitle, summary);
    logger.debug("Slack message: ", message);
    logger.debug("uri: ", uri);
    return sendNotificationToSlack(uri, message);
};

module.exports = {
    sendFailureMessage,
};

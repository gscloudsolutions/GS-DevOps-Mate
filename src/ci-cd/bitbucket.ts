import axios from "axios";

import logger from "@mate/system/logger";
import type { BuildInfo } from "@mate/system/types";

export async function getBuildInfo(): Promise<BuildInfo> {
    logConfiguration();

    const env = process.env;
    let buildReason = "";
    let prURL = "";

    // PR URL
    if (process.env.BITBUCKET_PR_ID) {
        prURL = `${process.env.BITBUCKET_GIT_HTTP_ORIGIN}/pull-requests/${process.env.BITBUCKET_PR_ID}`;
        buildReason = "Pull Request";
    }

    const steps = env.HOSTNAME?.split("-") ?? [];
    steps.pop();
    const stepId = steps.join("-");
    logger.debug("stepId: ", stepId);

    // Build and source URLs
    const buildResultsURL = `${env.BITBUCKET_GIT_HTTP_ORIGIN}/addon/pipelines/home#!/results/${env.BITBUCKET_BUILD_NUMBER}`;
    const sourceBranchURL = `${env.BITBUCKET_GIT_HTTP_ORIGIN}/branch/${env.BITBUCKET_BRANCH}`;
    const artifactPath = `${env.BITBUCKET_GIT_HTTP_ORIGIN}/addon/pipelines/home#!/results/${env.BITBUCKET_BUILD_NUMBER}/steps/{${stepId}}/artifacts`;

    // Gets user info
    let displayName = "Scheduled Pipeline";
    let authorAvatar = null;
    if (env.BITBUCKET_STEP_TRIGGERER_UUID) {
        const response = await axios.get(`https://api.bitbucket.org/2.0/users/${env.BITBUCKET_STEP_TRIGGERER_UUID}`);
        logger.debug("bitbucket user data: ", response.data);
        displayName = response.data.display_name;
        authorAvatar = response.data.links.avatar.href;
    }

    const buildInfo: BuildInfo = {
        buildName: env.BITBUCKET_BUILD_NUMBER,
        buildResultsURL: buildResultsURL,
        buildAuthorName: displayName,
        buildSourceBranch: env.BITBUCKET_BRANCH,
        buildSourceBranchURL: sourceBranchURL,
        buildReason: buildReason,
        prUrl: prURL,
        artifactPath: artifactPath,
        buildAuthorAvatar: undefined,
    };
    if (authorAvatar) {
        buildInfo.buildAuthorAvatar = authorAvatar;
    }

    return buildInfo;
}

function logConfiguration() {
    logger.debug("process.env.BITBUCKET_PR_ID: ", process.env.BITBUCKET_PR_ID);
    logger.debug("process.env.BITBUCKET_GIT_HTTP_ORIGIN: ", process.env.BITBUCKET_GIT_HTTP_ORIGIN);
    logger.debug("process.env.BITBUCKET_BUILD_NUMBER: ", process.env.BITBUCKET_BUILD_NUMBER);
    logger.debug("process.env.BITBUCKET_BRANCH: ", process.env.BITBUCKET_BRANCH);
    logger.debug("process.env.BITBUCKET_STEP_TRIGGERER_UUID: ", process.env.BITBUCKET_STEP_TRIGGERER_UUID);
}

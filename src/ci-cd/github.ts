import logger from "@mate/system/logger";
import type { BuildInfo } from "@mate/system/types";

export async function getBuildInfo(): Promise<BuildInfo> {
    const baseUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`;
    logConfiguration(baseUrl);

    return {
        buildName: `${process.env.GITHUB_WORKFLOW} - ${process.env.GITHUB_RUN_NUMBER}`,
        buildResultsURL: `${baseUrl}/actions/runs/${process.env.GITHUB_RUN_ID}`,
        buildAuthorName: process.env.GITHUB_ACTOR,
        buildSourceBranch: process.env.GITHUB_BASE_REF,
        buildSourceBranchURL: `${baseUrl}/tree/${process.env.GITHUB_BASE_REF}`,
        buildReason: process.env.GITHUB_EVENT_NAME,
        artifactPath: `${baseUrl}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    };
}

function logConfiguration(baseUrl: string) {
    logger.debug("process.env.GITHUB_RUN_ID: ", process.env.GITHUB_RUN_ID);
    logger.debug("process.env.GITHUB_WORKFLOW: ", process.env.GITHUB_WORKFLOW);
    logger.debug("process.env.GITHUB_RUN_NUMBER: ", process.env.GITHUB_RUN_NUMBER);
    logger.debug("process.env.GITHUB_ACTOR: ", process.env.GITHUB_ACTOR);
    logger.debug("process.env.GITHUB_SERVER_URL: ", process.env.GITHUB_SERVER_URL);
    logger.debug("process.env.GITHUB_REPOSITORY: ", process.env.GITHUB_REPOSITORY);
    logger.debug("process.env.GITHUB_BASE_REF: ", process.env.GITHUB_BASE_REF);
    logger.debug("process.env.GITHUB_EVENT_NAME: ", process.env.GITHUB_EVENT_NAME);
    logger.debug("BASE_URL: ", baseUrl);
}

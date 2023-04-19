import logger from "@mate/system/logger";
import { BuildInfo } from "./types";

export async function getBuildInfo(): Promise<BuildInfo> {
    logConfiguration();

    const sourceBranch = process.env.BUILD_SOURCEBRANCH?.replace("refs/heads", "branch");

    return {
        buildName: `${process.env.SYSTEM_DEFINITIONNAME} - ${process.env.BUILD_BUILDNUMBER}`,
        buildResultsURL: `${process.env.SYSTEM_TEAMFOUNDATIONSERVERURI}${process.env.SYSTEM_TEAMPROJECT}/_build/results?buildId=${process.env.BUILD_BUILDID}`,
        buildAuthorName: process.env.BUILD_QUEUEDBY,
        buildSourceBranch: sourceBranch,
        buildSourceBranchURL: `${process.env.BUILD_REPOSITORY_URI}/${sourceBranch}`,
        buildReason: process.env.BUILD_REASON,
        artifactPath: `${process.env.SYSTEM_TEAMFOUNDATIONSERVERURI}${process.env.SYSTEM_TEAMPROJECT}/_build/results?buildId=${process.env.BUILD_BUILDID}&view=artifacts`,
    };
}

function logConfiguration() {
    logger.debug("process.env.BUILD_BUILDID: ", process.env.BUILD_BUILDID);
    logger.debug("process.env.SYSTEM_DEFINITIONNAME: ", process.env.SYSTEM_DEFINITIONNAME);
    logger.debug("process.env.BUILD_BUILDNUMBER: ", process.env.BUILD_BUILDNUMBER);
    logger.debug("process.env.BUILD_SOURCEVERSIONAUTHOR: ", process.env.BUILD_SOURCEVERSIONAUTHOR);
    logger.debug("process.env.BUILD_REASON: ", process.env.BUILD_REASON);
    logger.debug("process.env.BUILD_REPOSITORY_PROVIDER: ", process.env.BUILD_REPOSITORY_PROVIDER);
    logger.debug("process.env.BUILD_REPOSITORY_URI: ", process.env.BUILD_REPOSITORY_URI);
    logger.debug("process.env.BUILD_SOURCEBRANCH: ", process.env.BUILD_SOURCEBRANCH);
    logger.debug("process.env.BUILD_SOURCEVERSION: ", process.env.BUILD_SOURCEVERSION);
    logger.debug("process.env.BUILD_QUEUEDBY: ", process.env.BUILD_QUEUEDBY);
    logger.debug("process.env.SYSTEM_TEAMFOUNDATIONSERVERURI: ", process.env.SYSTEM_TEAMFOUNDATIONSERVERURI);
    logger.debug("process.env.SYSTEM_TEAMPROJECT: ", process.env.SYSTEM_TEAMPROJECT);
}

import axios from "axios";
import logger from "./logger";

const ciCDSpecificMessaging = {
    BBPipelines: {
        async getBuildInfo() {
            const sourceBranchURL = `${process.env.BITBUCKET_GIT_HTTP_ORIGIN}/branch/${process.env.BITBUCKET_BRANCH}`;
            let buildReason = "";
            let prURL = "";
            if (process.env.BITBUCKET_PR_ID) {
                prURL = `${process.env.BITBUCKET_GIT_HTTP_ORIGIN}/pull-requests/${process.env.BITBUCKET_PR_ID}`;
                buildReason = "Pull Request";
            }
            let DISPLAY_NAME = "Scheduled Pipeline";
            let AUTHOR_AVATAR = null;
            if (process.env.BITBUCKET_STEP_TRIGGERER_UUID) {
                const response = await axios.get(
                    `https://api.bitbucket.org/2.0/users/${process.env.BITBUCKET_STEP_TRIGGERER_UUID}`
                );
                logger.debug("response: ", response.data);
                DISPLAY_NAME = response.data.display_name;
                AUTHOR_AVATAR = response.data.links.avatar.href;
            }

            const steps = process.env.HOSTNAME.split("-");
            steps.pop();
            const stepId = steps.join("-");
            logger.debug("stepId: ", stepId);

            const buildInfo = {
                BuildName: process.env.BITBUCKET_BUILD_NUMBER,
                BuildResultsURL: `${process.env.BITBUCKET_GIT_HTTP_ORIGIN}/addon/pipelines/home#!/results/${process.env.BITBUCKET_BUILD_NUMBER}`,
                BuildAuthorName: DISPLAY_NAME,
                BuildSourceBranch: process.env.BITBUCKET_BRANCH,
                BuildSourceBranchURL: sourceBranchURL,
                PRUrl: prURL,
                BuildReason: buildReason,
                ArtifactPath: `${process.env.BITBUCKET_GIT_HTTP_ORIGIN}/addon/pipelines/home#!/results/${process.env.BITBUCKET_BUILD_NUMBER}/steps/{${stepId}}/artifacts`,
                BuildAuthorAvatar: undefined,
            };
            if (AUTHOR_AVATAR) {
                buildInfo.BuildAuthorAvatar = AUTHOR_AVATAR;
            }

            return buildInfo;
        },
    },

    AzureDevOps: {
        async getBuildInfo() {
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
            const sourceBranch = process.env.BUILD_SOURCEBRANCH.replace("refs/heads", "branch");
            return {
                BuildName: `${process.env.SYSTEM_DEFINITIONNAME} - ${process.env.BUILD_BUILDNUMBER}`,
                BuildResultsURL: `${process.env.SYSTEM_TEAMFOUNDATIONSERVERURI}${process.env.SYSTEM_TEAMPROJECT}/_build/results?buildId=${process.env.BUILD_BUILDID}`,
                BuildAuthorName: process.env.BUILD_QUEUEDBY,
                BuildSourceBranch: sourceBranch,
                BuildSourceBranchURL: `${process.env.BUILD_REPOSITORY_URI}/${sourceBranch}`,
                BuildReason: process.env.BUILD_REASON,
                ArtifactPath: `${process.env.SYSTEM_TEAMFOUNDATIONSERVERURI}${process.env.SYSTEM_TEAMPROJECT}/_build/results?buildId=${process.env.BUILD_BUILDID}&view=artifacts`,
            };
        },
    },

    GitHubActions: {
        async getBuildInfo() {
            logger.debug("process.env.GITHUB_WORKFLOW: ", process.env.GITHUB_WORKFLOW);
            logger.debug("process.env.GITHUB_RUN_NUMBER: ", process.env.GITHUB_RUN_NUMBER);
            logger.debug("process.env.GITHUB_ACTOR: ", process.env.GITHUB_ACTOR);
            logger.debug("process.env.GITHUB_SERVER_URL: ", process.env.GITHUB_SERVER_URL);
            logger.debug("process.env.GITHUB_REPOSITORY: ", process.env.GITHUB_REPOSITORY);
            logger.debug("process.env.GITHUB_ACTION: ", process.env.GITHUB_ACTION);
            logger.debug("process.env.GITHUB_BASE_REF: ", process.env.GITHUB_BASE_REF);
            logger.debug("process.env.GITHUB_EVENT_NAME: ", process.env.GITHUB_EVENT_NAME);
            const BASE_URL = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`;
            logger.debug("BASE_URL: ", BASE_URL);
            return {
                BuildName: `${process.env.GITHUB_WORKFLOW} - ${process.env.GITHUB_RUN_NUMBER}`,
                BuildResultsURL: `${BASE_URL}/actions/runs/${process.env.GITHUB_RUN_ID}`,
                BuildAuthorName: process.env.GITHUB_ACTOR,
                BuildSourceBranch: process.env.GITHUB_BASE_REF,
                BuildSourceBranchURL: `${BASE_URL}/tree/${process.env.GITHUB_BASE_REF}`,
                BuildReason: process.env.GITHUB_EVENT_NAME,
                ArtifactPath: `${BASE_URL}/actions/runs/${process.env.GITHUB_RUN_ID}`,
            };
        },
    },
};

export default ciCDSpecificMessaging;

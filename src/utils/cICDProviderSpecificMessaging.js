const axios = require('axios');
const logger = require('./logger');

const ciCDSpecificMessaging = {
    BBPipelines: {
        async getBuildInfo() {
            const sourceBranchURL = `${process.env.BITBUCKET_GIT_HTTP_ORIGIN}/branch/${process.env.BITBUCKET_BRANCH}`;
            let buildReason = '';
            let prURL = '';
            if (process.env.BITBUCKET_PR_ID) {
                prURL = `${process.env.BITBUCKET_GIT_HTTP_ORIGIN}/pull-requests/${process.env.BITBUCKET_PR_ID}`;
                buildReason = 'Pull Request';
            }

            const response = await axios.get(`https://api.bitbucket.org/2.0/users/${process.env.BITBUCKET_STEP_TRIGGERER_UUID}`);
            logger.debug('response: ', response.data);

            const steps = process.env.HOSTNAME.split('-');
            steps.pop();
            const stepId = steps.join('-');
            logger.debug('stepId: ', stepId);

            return {
                BuildName: process.env.BITBUCKET_BUILD_NUMBER,
                BuildResultsURL: `${process.env.BITBUCKET_GIT_HTTP_ORIGIN}/addon/pipelines/home#!/results/${process.env.BITBUCKET_BUILD_NUMBER}`,
                BuildAuthorName: response.data.display_name,
                BuildAuthorAvatar: response.data.links.avatar.href,
                BuildSourceBranch: process.env.BITBUCKET_BRANCH,
                BuildSourceBranchURL: sourceBranchURL,
                PRUrl: prURL,
                BuildReason: buildReason,
                ArtifactPath: `${process.env.BITBUCKET_GIT_HTTP_ORIGIN}/addon/pipelines/home#!/results/${process.env.BITBUCKET_BUILD_NUMBER}/steps/{${stepId}}/artifacts`,
            };
        },
    },

    AzureDevOps: {
        async getBuildInfo() {
            logger.debug('process.env.BUILD_BUILDID: ', process.env.BUILD_BUILDID);
            logger.debug('process.env.SYSTEM_DEFINITIONNAME: ', process.env.SYSTEM_DEFINITIONNAME);
            logger.debug('process.env.BUILD_BUILDNUMBER: ', process.env.BUILD_BUILDNUMBER);
            logger.debug('process.env.BUILD_SOURCEVERSIONAUTHOR: ', process.env.BUILD_SOURCEVERSIONAUTHOR);
            logger.debug('process.env.BUILD_REASON: ', process.env.BUILD_REASON);
            logger.debug('process.env.BUILD_REPOSITORY_PROVIDER: ', process.env.BUILD_REPOSITORY_PROVIDER);
            logger.debug('process.env.BUILD_REPOSITORY_URI: ', process.env.BUILD_REPOSITORY_URI);
            logger.debug('process.env.BUILD_SOURCEBRANCH: ', process.env.BUILD_SOURCEBRANCH);
            logger.debug('process.env.BUILD_SOURCEVERSION: ', process.env.BUILD_SOURCEVERSION);
            logger.debug('process.env.BUILD_QUEUEDBY: ', process.env.BUILD_QUEUEDBY);
            logger.debug('process.env.SYSTEM_TEAMFOUNDATIONSERVERURI: ', process.env.SYSTEM_TEAMFOUNDATIONSERVERURI);
            logger.debug('process.env.SYSTEM_TEAMPROJECT: ', process.env.SYSTEM_TEAMPROJECT);
            const sourceBranch = process.env.BUILD_SOURCEBRANCH.replace('refs/heads', 'branch');
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
};

module.exports = {
    ciCDSpecificMessaging,
};

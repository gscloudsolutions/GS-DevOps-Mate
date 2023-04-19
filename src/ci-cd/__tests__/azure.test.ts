import logger from "@mate/system/logger";
import { getBuildInfo } from "@mate/ci-cd";

describe("azure", () => {
    describe("getBuildInfo", () => {
        beforeEach(() => {
            logger.level = "off";
        });

        it("should get build info from env variables", async () => {
            const env = process.env;

            env.CI_CD_PROVIDER = "AZURE";

            env.BUILD_BUILDID = "ID456";
            env.SYSTEM_DEFINITIONNAME = "TEST";
            env.BUILD_BUILDNUMBER = "123";
            env.BUILD_REASON = "Test Azure Build Info";
            env.BUILD_REPOSITORY_PROVIDER = "Azure";
            env.BUILD_REPOSITORY_URI = "https://repo.test";
            env.BUILD_SOURCEBRANCH = "test-branch";
            env.BUILD_SOURCEVERSION = "v1.0";
            env.BUILD_QUEUEDBY = "Leo";
            env.SYSTEM_TEAMFOUNDATIONSERVERURI = "https://foundation.test/";
            env.SYSTEM_TEAMPROJECT = "devops-mate";

            expect(getBuildInfo()).resolves.toEqual({
                artifactPath: "https://foundation.test/devops-mate/_build/results?buildId=ID456&view=artifacts",
                buildAuthorName: "Leo",
                buildName: "TEST - 123",
                buildReason: "Test Azure Build Info",
                buildResultsURL: "https://foundation.test/devops-mate/_build/results?buildId=ID456",
                buildSourceBranch: "test-branch",
                buildSourceBranchURL: "https://repo.test/test-branch",
            });
        });
    });
});

import logger from "@mate/system/logger";
import { getBuildInfo } from "@mate/ci-cd";

describe("github", () => {
    describe("getBuildInfo", () => {
        beforeEach(() => {
            logger.level = "off";
        });

        it("should get build info from env variables", async () => {
            const env = process.env;

            env.CI_CD_PROVIDER = "GITHUB";

            env.GITHUB_RUN_ID = "run888";
            env.GITHUB_SERVER_URL = "https://github.test";
            env.GITHUB_REPOSITORY = "devops-mate";
            env.GITHUB_WORKFLOW = "flow";
            env.GITHUB_RUN_NUMBER = "1999";
            env.GITHUB_ACTOR = "test-run";
            env.GITHUB_BASE_REF = "devops-base";
            env.GITHUB_EVENT_NAME = "test";

            expect(getBuildInfo()).resolves.toEqual({
                artifactPath: "https://github.test/devops-mate/actions/runs/run888",
                buildAuthorName: "test-run",
                buildName: "flow - 1999",
                buildReason: "test",
                buildResultsURL: "https://github.test/devops-mate/actions/runs/run888",
                buildSourceBranch: "devops-base",
                buildSourceBranchURL: "https://github.test/devops-mate/tree/devops-base",
            });
        });
    });
});

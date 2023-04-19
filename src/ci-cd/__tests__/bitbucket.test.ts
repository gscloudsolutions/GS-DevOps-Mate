import logger from "@mate/system/logger";
import axios from "axios";
import { getBuildInfo } from "@mate/ci-cd";

jest.mock("axios");
const axiosMock = axios as jest.Mocked<typeof axios>;

describe("bitbucket", () => {
    describe("getBuildInfo", () => {
        beforeEach(() => {
            logger.level = "off";
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it("should get build info from env variables", async () => {
            const env = process.env;

            axiosMock.get.mockImplementation(() =>
                Promise.resolve({
                    data: {
                        display_name: "Leo",
                        links: { avatar: { href: "https://user_image.test" } },
                    },
                })
            );

            env.CI_CD_PROVIDER = "BITBUCKET";
            env.HOSTNAME = "tst-001";

            env.BITBUCKET_PR_ID = "ID555";
            env.BITBUCKET_GIT_HTTP_ORIGIN = "https://repo.test";
            env.BITBUCKET_BUILD_NUMBER = "123";
            env.BITBUCKET_BRANCH = "test-branch";
            env.BITBUCKET_STEP_TRIGGERER_UUID = "USER123";

            expect(getBuildInfo()).resolves.toEqual({
                artifactPath: "https://repo.test/addon/pipelines/home#!/results/123/steps/{tst}/artifacts",
                buildAuthorAvatar: "https://user_image.test",
                buildAuthorName: "Leo",
                buildName: "123",
                buildReason: "Pull Request",
                buildResultsURL: "https://repo.test/addon/pipelines/home#!/results/123",
                buildSourceBranch: "test-branch",
                buildSourceBranchURL: "https://repo.test/branch/test-branch",
                prUrl: "https://repo.test/pull-requests/ID555",
            });
        });

        it("should generate artifactPath without seq number when hostname is undefined", async () => {
            const env = process.env;

            axiosMock.get.mockImplementation(() =>
                Promise.resolve({
                    data: {
                        display_name: "Leo",
                        links: { avatar: { href: "https://user_image.test" } },
                    },
                })
            );

            env.CI_CD_PROVIDER = "BITBUCKET";
            delete env.HOSTNAME;

            env.BITBUCKET_GIT_HTTP_ORIGIN = "https://repo.test";
            env.BITBUCKET_BUILD_NUMBER = "333";

            expect(getBuildInfo()).resolves.toEqual(
                expect.objectContaining({
                    artifactPath: "https://repo.test/addon/pipelines/home#!/results/333/steps/{}/artifacts",
                })
            );
        });
    });
});

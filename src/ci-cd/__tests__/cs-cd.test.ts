import logger from "@mate/system/logger";
import { getBuildInfo } from "@mate/ci-cd";
import { defaultBuildInfo as mockDefaultBuildInfo } from "./__fixtures__/build-info";

describe("ci-cd", () => {
    describe("getBuildInfo", () => {
        beforeEach(() => {
            logger.level = "off";
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it("should use the provider API when CI_CD_PROVIDER is a valid module", async () => {
            const ciCdProvider = "valid-ci-cd";
            jest.mock(
                "../valid-ci-cd",
                () => {
                    return {
                        getBuildInfo: jest.fn().mockReturnValue(mockDefaultBuildInfo),
                    };
                },
                { virtual: true }
            );

            process.env.CI_CD_PROVIDER = ciCdProvider;

            expect(getBuildInfo()).resolves.toEqual(mockDefaultBuildInfo);
        });

        it("should propagate the original exception when a not known error happens", async () => {
            const ciCdProvider = "exception-ci-cd";
            jest.mock(
                "../exception-ci-cd",
                () => {
                    return { getBuildInfo: jest.fn().mockRejectedValue(new Error("Generic test error")) };
                },
                { virtual: true }
            );

            process.env.CI_CD_PROVIDER = ciCdProvider;
            await expect(getBuildInfo()).rejects.toThrowError("Generic test error");
        });

        it("should throw error when CI_CD_PROVIDER is empty", () => {
            const ciCdProvider = "";
            process.env.CI_CD_PROVIDER = ciCdProvider;

            expect(getBuildInfo()).rejects.toThrowError("CI_CD_PROVIDER environment variable is not defined");
        });

        it.each([undefined, "not-implemented"])("should throw error when CI_CD_PROVIDER is %s", (ciCdProvider) => {
            process.env.CI_CD_PROVIDER = ciCdProvider;

            expect(getBuildInfo()).rejects.toThrowError(
                `The provider defined on the CI_CD_PROVIDER environment is not implemented or is invalid. Value: ${ciCdProvider}`
            );
        });
    });
});

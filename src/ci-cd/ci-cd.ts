import logger from "@mate/system/logger";
import { BuildInfo } from "./types";

export async function getBuildInfo(): Promise<BuildInfo> {
    const ciCdProvider: string | undefined = process.env.CI_CD_PROVIDER;
    if (!ciCdProvider || typeof ciCdProvider !== "string") {
        throw new Error("CI_CD_PROVIDER environment variable is not defined");
    }

    try {
        const providerModule = await import(`./${ciCdProvider.toLowerCase()}`);
        return await providerModule.getBuildInfo();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        logger.error(error);
        if (error?.code === "MODULE_NOT_FOUND") {
            throw new Error(
                `The provider defined on the CI_CD_PROVIDER environment is not implemented or is invalid. Value: ${ciCdProvider}`
            );
        }
        throw error;
    }
}

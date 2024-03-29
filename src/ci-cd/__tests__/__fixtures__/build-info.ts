import { BuildInfo } from "@mate/system/types";

export const defaultBuildInfo: BuildInfo = Object.freeze({
    buildName: "",
    buildResultsURL: "",
    buildAuthorName: "",
    buildSourceBranch: "",
    buildSourceBranchURL: "",
    buildReason: "",
    artifactPath: "",
});

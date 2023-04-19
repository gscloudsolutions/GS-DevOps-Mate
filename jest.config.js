import { pathsToModuleNameMapper } from "ts-jest";
import tsconfig from "./tsconfig.json" assert { type: "json" };

export default {
    collectCoverage: true,
    coverageDirectory: ".temp/coverage",
    coveragePathIgnorePatterns: ["/node_modules/", ".yarn"],
    verbose: true,
    roots: ["<rootDir>"],
    modulePaths: [tsconfig.compilerOptions.baseUrl],
    moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions.paths, { prefix: "<rootDir>/" }),
    preset: "ts-jest/presets/js-with-babel",
};

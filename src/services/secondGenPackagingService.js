/* Copyright (c) 2019 Groundswell Cloud Solutions Inc. - All Rights Reserved
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF
 * ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
 * USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

const shellJS = require("shelljs");
const type = require("type-detect");

const authenticate = require("./authenticationService");
const logger = require("../utils/logger");
const ciCDProviderMessaging = require("../utils/cICDProviderSpecificMessaging").ciCDSpecificMessaging;

const PACKAGE_NAME = process.env.PACKAGE_NAME || "";
const { CI_CD_PROVIDER } = process.env;

const createPackageVersionCommand = (command) => {
    try {
        let versionCommand = "SFDX_JSON_TO_STDOUT=true sfdx force:package:version:create -w 20 --json";
        logger.debug("type of command.codecoverage", type(command.codecoverage));
        parseInt(command.codecoverage); // This step is to generate the exception if code coverage is not a valid String that can be converted into a Integer
        if (type(command.codecoverage) === "string") {
            versionCommand += " --codecoverage";
        }
        if (command.path) {
            versionCommand += ` --path ${command.path}`;
        }
        if (command.installationkey) {
            versionCommand += ` -k ${command.installationkey}`;
        }
        if (command.versionnumber) {
            versionCommand += ` -n ${command.versionnumber}`;
        }
        if (command.package) {
            versionCommand += ` --package ${command.package}`;
        }
        if (command.installationkeybypass === true || command.installationkeybypass === "true") {
            versionCommand += " -x";
        }
        if (command.branch) {
            versionCommand += ` --branch ${command.branch}`;
        }
        if (command.tag) {
            const shortRevision = command.tag.substring(0, 7);
            versionCommand += ` --tag ${shortRevision}`;
        }
        return versionCommand;
    } catch (error) {
        logger.error(error);
        throw new Error(error);
    }
};

const getVersionReport = (result) =>
    new Promise((resolve, reject) => {
        logger.debug("result: ", result);
        const sfdxCommand = `SFDX_JSON_TO_STDOUT=true sfdx force:package:version:report -p ${result.result.SubscriberPackageVersionId} -v ${result.targetDevHubUsername} --json --verbose`;
        logger.debug("executing command :: ", sfdxCommand);
        const commandOutput = shellJS.exec(sfdxCommand).stdout;
        logger.debug("commandOutput: ", commandOutput);
        const report = JSON.parse(commandOutput);
        logger.debug("report: ", report);
        if (report.status === 0) {
            logger.debug("Got the version report");
            resolve(report);
        } else {
            logger.error("error: ", report);
            reject(report);
        }
    });

const createPackageVersion = (command) =>
    new Promise((resolve, reject) => {
        try {
            const packageVersionCommand = createPackageVersionCommand(command);
            if (command.targetdevhubusername && command.targetdevhubpassword) {
                authenticate
                    .loginWithCreds(command.targetdevhubusername, command.targetdevhubpassword, "PRODUCTION")
                    .then((connection) => {
                        // eslint-disable-next-line max-len
                        // set the url configuration, required in case of running sfdx commands with access token
                        shellJS.exec(`sfdx force:config:set instanceUrl=${connection.instanceURL} --global`);
                        const sfdxCommand = `${packageVersionCommand} -v ${connection.accessToken}`;
                        logger.debug("executing command :: ", sfdxCommand);
                        const commandOutput = shellJS.exec(sfdxCommand).stdout;
                        logger.debug("commandOutput: ", commandOutput);
                        const result = JSON.parse(commandOutput);
                        logger.debug("result: ", result);
                        if (result.status === 0) {
                            logger.debug("Package Versioning Successful");
                            result.targetDevHubUsername = connection.accessToken;
                            resolve(result);
                        } else {
                            logger.error("result: ", result);
                            reject(result);
                        }
                    });
            } else {
                const sfdxCommand = `${packageVersionCommand} -v ${command.targetdevhubusername}`;
                logger.debug("executing command :: ", sfdxCommand);
                const commandOutput = shellJS.exec(sfdxCommand).stdout;
                logger.debug("commandOutput: ", commandOutput);
                const result = JSON.parse(commandOutput);
                logger.debug("result: ", result);
                if (result.status === 0) {
                    logger.debug("Package Versioning Successful");
                    result.targetDevHubUsername = command.targetdevhubusername;
                    resolve(result);
                } else {
                    logger.debug("result: ", result);
                    reject(result);
                }
            }
        } catch (error) {
            logger.error(error);
            reject(new Error(error));
        }
    });

const createProviderSpecificMessage = (buildInfo) => {
    let buildMessage = "";
    const buildURL = buildInfo.BuildResultsURL ? buildInfo.BuildResultsURL : "";
    buildMessage += buildInfo.BuildName ? `\n Build Name: <${buildURL}|${buildInfo.BuildName}>` : "";
    buildMessage +=
        buildInfo.BuildReason || buildInfo.BuildAuthorName
            ? `\n ${buildInfo.BuildReason} Run by: ${buildInfo.BuildAuthorName}`
            : "";
    buildMessage += buildInfo.BuildSourceBranch
        ? `\n Source Branch: <${buildInfo.BuildSourceBranchURL}|${buildInfo.BuildSourceBranch}>`
        : "";
    buildMessage += buildInfo.ArtifactPath ? `\n Artifact can be found <${buildInfo.ArtifactPath}|here>` : "";
    return buildMessage;
};

const generateSuccessfulPackageCreationMessage = async (successMessage) => {
    const blocks = [];

    let buildMessage = "";
    const buildInfo = await ciCDProviderMessaging[CI_CD_PROVIDER].getBuildInfo();

    if (buildInfo) {
        buildMessage = createProviderSpecificMessage(buildInfo);
    }
    logger.debug("buildMessage: ", buildMessage);

    // eslint-disable-next-line no-nested-ternary
    // const buildURL = CI_CD_PROVIDER
    //     ? (ciCDProviderMessaging[CI_CD_PROVIDER] ? ciCDProviderMessaging[CI_CD_PROVIDER].generateBuildURL() : '') : '';

    // eslint-disable-next-line no-nested-ternary
    // const buildMessage = CI_CD_PROVIDER
    //     ? (ciCDProviderMessaging[CI_CD_PROVIDER] ? `<${buildURL}|Build Id: ${ciCDProviderMessaging[CI_CD_PROVIDER].getBuildNumber()}>` : '') : '';

    blocks.push(
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: "*:tada: Package Versioning Build successful:*",
            },
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `${successMessage}. \n ${buildMessage}`,
            },
        }
    );
    logger.debug("blocks: ", blocks);
    return {
        blocks,
    };
};

const generatePackageCreationFailureMessage = async (error) => {
    logger.error("error", error);
    const blocks = [];

    // eslint-disable-next-line no-nested-ternary
    // const buildURL = CI_CD_PROVIDER
    //     ? (ciCDProviderMessaging[CI_CD_PROVIDER] ? ciCDProviderMessaging[CI_CD_PROVIDER].generateBuildURL() : '') : '';

    // eslint-disable-next-line no-nested-ternary
    // const buildMessage = CI_CD_PROVIDER
    //     ? (ciCDProviderMessaging[CI_CD_PROVIDER] ? `<${buildURL}|Build Id: ${ciCDProviderMessaging[CI_CD_PROVIDER].getBuildNumber()}>` : '') : '';
    let buildMessage = "";
    const buildInfo = await ciCDProviderMessaging[CI_CD_PROVIDER].getBuildInfo();

    if (buildInfo) {
        buildMessage = createProviderSpecificMessage(buildInfo);
    }
    logger.debug("buildMessage: ", buildMessage);

    blocks.push(
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: "*:fire: Package Versioning Build failure:*",
            },
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `${error.message}. \n ${buildMessage}`,
            },
        }
    );
    logger.debug("blocks: ", blocks);
    return {
        blocks,
    };
};

const handlePackageCodeCoverage = (report, minRequiredCodeCoverage) =>
    new Promise((resolve, reject) => {
        logger.debug("report: ", report);
        const parsedReport = report;
        if (minRequiredCodeCoverage) {
            const minCodeCoveragePercentage = parseInt(minRequiredCodeCoverage);
            if (parsedReport.result.CodeCoverage.apexCodeCoveragePercentage >= minCodeCoveragePercentage) {
                // eslint-disable-next-line max-len
                const successMessage1 = `The package version *${parsedReport.result.MajorVersion}.${parsedReport.result.MinorVersion}.${parsedReport.result.PatchVersion}.${parsedReport.result.BuildNumber}*  with SubscriberPackageVersionId as: _${parsedReport.result.SubscriberPackageVersionId}_ of the package *${PACKAGE_NAME}* is created successfully with code coverage of *${parsedReport.result.CodeCoverage.apexCodeCoveragePercentage}%* and _thus can be installed successfully_`;
                // eslint-disable-next-line max-len
                const successMessage2 = `Installation Links: https://login.salesforce.com/packagingSetupUI/ipLanding.app?apvId=${parsedReport.result.SubscriberPackageVersionId}, For sandbox use: https://test.salesforce.com/packagingSetupUI/ipLanding.app?apvId=${parsedReport.result.SubscriberPackageVersionId}`;
                resolve(`${successMessage1} \n ${successMessage2}`);
            } else {
                // eslint-disable-next-line max-len
                reject(
                    new Error(
                        `The package version *${parsedReport.result.MajorVersion}.${parsedReport.result.MinorVersion}.${parsedReport.result.PatchVersion}.${parsedReport.result.BuildNumber}* with SubscriberPackageVersionId as: _${parsedReport.result.SubscriberPackageVersionId}_ of the package *${PACKAGE_NAME}* is created successfully but could not meet the min code-coverage criteria of *${minCodeCoveragePercentage}%*. Code coverage of this package version is: *${parsedReport.result.CodeCoverage.apexCodeCoveragePercentage}%* and _thus it is not installable_`
                    )
                );
            }
        } else {
            logger.info("No Code Coverage required");
            // eslint-disable-next-line max-len
            resolve(
                `No Code Coverage required, and thus the package version *${parsedReport.result.MajorVersion}.${parsedReport.result.MinorVersion}.${parsedReport.result.PatchVersion}.${parsedReport.result.BuildNumber}* with SubscriberPackageVersionId as: _${parsedReport.result.SubscriberPackageVersionId}_ of the package *${PACKAGE_NAME}* can be installed`
            );
        }
    });

module.exports = {
    createPackageVersion,
    getVersionReport,
    generateSuccessfulPackageCreationMessage,
    generatePackageCreationFailureMessage,
    handlePackageCodeCoverage,
};

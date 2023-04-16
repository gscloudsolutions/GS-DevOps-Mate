#!/usr/bin/env node

/* Copyright (c) 2019-2023 Groundswell Cloud Solutions Inc. - All Rights Reserved
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF
 * ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
 * USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

const program = require("commander");
const shellJS = require("shelljs");

const artifactCreator = require("../services/packageCreationService");
const secondGenPackaging = require("../services/secondGenPackagingService");
const logger = require("../utils/logger");
const notify = require("../utils/notificationsUtil");

// Various Command Definitions and Actions for Artifacts/Packages creation
program.description("Set of commands to create different type of artifacts/packages");

// Multiple/Multi-Module Artifacts/Packages creation for a SFDX Repo/Directory
program
    .command("source-multi")
    .description("Creates deployable MDAPI artifacts for each module in a multi-module SFDX repository.")
    .option("-v --packageVersion <version>", "Custom version identifier of an artifact")
    .option("-n --newCommit [nc]", "Latest commit-sha or git tag used for diff comparison.")
    .option("-o --oldCommit [oc]", "Older commit-sha or git tag used for diff comparison.")
    .option("-p --artifactsLocation <aLocation>", "The path for storing generated artifacts.")
    .option("-l --projectLocation <pLocation>", "The path of the project or repository.")
    .option("-i --buildId <id>", "Build-Id/Build-Number for uniquely identifying the deployment information.")
    .action((command) => {
        artifactCreator.createPackage(command, "source-multi", artifactCreator.createMultipleArtifacts);
    });

// Combined/Single Artifacts/Packages creation for a SFDX Repo/Directory
program
    .command("source-combined")
    .description("Creates a single deployable MDAPI artifact from a multi-module SFDX repository.")
    .option("-v, --packageVersion <version>", "Custom version identifier of an artifact")
    .option("-n, --newCommit [nc]", "Latest commit-sha or git tag used for diff comparison.")
    .option("-o, --oldCommit [oc]", "Older commit-sha or git tag used for diff comparison.")
    .option("-p --artifactsLocation <aLocation>", "The path for storing generated artifacts.")
    .option("-l --projectLocation <pLocation>", "The path of the project or repository.")
    .option("-i --buildId <id>", "Build-Id/Build-Number for uniquely identifying the deployment information.")
    .option("-f --full <full>", "This flag will override everything and go for a full deployment")
    .action((command) => {
        artifactCreator.createPackage(command, "source-combined", artifactCreator.createCombinedArtifact);
    });

// Artifact/Package Creation for a Non-SFDX Repo/Directory
program
    .command("mdapi")
    .description("Creates a single deployable artifact from non-SFDX format repository.")
    .option("-v, --packageVersion <version>", "Custom version identifier of an artifact")
    .option("-n, --newCommit [nc]", "Latest commit-sha or git tag used for diff comparison.")
    .option("-o, --oldCommit [oc]", "Older commit-sha or git tag used for diff comparison.")
    .option("-p --artifactsLocation <aLocation>", "The path for storing generated artifacts.")
    .option("-l --projectLocation <pLocation>", "The path of the project or repository.")
    .option("-i --buildId <id>", "Build-Id/Build-Number for uniquely identifying the deployment information.")
    .option("-f --full <full>", "This flag will override everything and go for a full deployment")
    .action((command) => {
        artifactCreator.createPackage(command, "mdapi", artifactCreator.createMDAPIPackageArtifact);
    });

program
    .command("second-gen-version")
    .description("Create a second generation package version")
    // .option('-a --versionname <name>', 'the name of the package version to be created')
    .option("-b --branch <branch>", "the package version’s branch")
    .option("-c --codecoverage <coverage>", " calculate the code coverage by running the packaged Apex tests.")
    .option("-d --path <path>", " path to directory that contains the contents of the package")
    // .option('-e --versiondescription <description>', 'the description of the package version to be created')
    // .option('-f --definitionfile <file>', 'path to a definition file similar to scratch org definition file that contains the list of features and org \n' +
    // '                                                   preferences that the metadata of the package version depends on')
    .option(
        "-k --installationkey <key>",
        "installation key for key-protected package (either --installationkey or --installationkeybypass is required)"
    )
    .option("-n --versionnumber <vnumber>", "the version number of the package version to be created")
    .option("-p --package <package>", "ID (starts with 0Ho) or alias of the package to create a version of")
    // .option('-t --tag <tag>', 'the package version’s tag')
    .option(
        "-v --targetdevhubusername <username>",
        "username or alias for the dev hub org; overrides default dev hub org"
    )
    .option("-s --targetdevhubpassword <password>", "password for the dev hub org")
    .option("-t --tag <tag>", "the package version’s tag")
    .option(
        "-x --installationkeybypass <keybypass>",
        "bypass the installation key requirement (either --installationkey or --installationkeybypass is required)\n"
    )
    .option("--workingDirectory <workingdir>", "working directory of the build service")
    .action((command) => {
        logger.debug("command: ", command);
        logger.debug("workingDirectory: ", command.workingDirectory);
        shellJS.exec("pwd");
        // shellJS.exec(`cd ${command.workingDirectory}`);
        // shellJS.exec('pwd');
        secondGenPackaging
            .createPackageVersion(command)
            .then((result) => {
                logger.debug("Versioning Successful, now looking for the report for codecoverage");
                logger.debug("result: ", result);
                return secondGenPackaging.getVersionReport(result);
            })
            .then((report) => {
                logger.debug("Version Reporting Successful");
                logger.debug("report: ", report);
                return secondGenPackaging.handlePackageCodeCoverage(report, command.codecoverage);
            })
            .then((successMessage) => {
                logger.debug("Code Coverage Successful");
                logger.debug("successMessage: ", successMessage);
                secondGenPackaging
                    .generateSuccessfulPackageCreationMessage(successMessage)
                    .then((message) => notify.sendNotificationToSlack(SLACK_WEBHOOK_URL, message))
                    .then((message) => {
                        logger.debug(message);
                        process.exit(0);
                    })
                    .catch((err) => {
                        logger.error(err);
                        process.exit(0);
                    });
            })
            .catch((error) => {
                logger.error(error);
                secondGenPackaging
                    .generatePackageCreationFailureMessage(error)
                    .then((message) => notify.sendNotificationToSlack(SLACK_WEBHOOK_URL, message))
                    .then((message) => {
                        logger.debug(message);
                        process.exit(1);
                    })
                    .catch((err) => {
                        logger.error(err);
                        process.exit(1);
                    });
            });
    });

program.parse(process.argv);

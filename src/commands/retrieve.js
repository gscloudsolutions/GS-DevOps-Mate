#!/usr/bin/env node

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
const program = require("commander");

const authService = require("../services/authenticationService");
const logger = require("../utils/logger");
const retrieveService = require("../services/retrievalService");

// Variable to hold the location of the project for which deployable
// metadata packages would be created or from where source
// based modular deployments take place
let workingDirectory = process.env.PROJECT_PATH || ".";
logger.debug(`createPackages.js: Code is executing in ${__dirname} directory`);

program.description("Retrieve unmanaged/managed package or a chageset in source/mdapi format");

program
    .command("src-format")
    .description("Retrieve unmanaged/managed package or a chageset in source format")
    .option("-u --username <name>", "Username of org to retrieve from")
    .option("-s --password <password>", "Password of org to retrieve from")
    .option("-t --type <type>", "Type of target org")
    .option("-p --projectLocation <package>", "Location of the project, default is the current directory")
    .option("-b --branchName <branch>", "Name of the branch, default would be feature/<packageName>")
    .option("-n --packageName <package>", "Name of the package that needs to be retrieved")
    .option("-m --moduleName <module>", "Name of the module in which the package needs to be pulled in")
    .action((command) => {
        const branchName = command.branchName?.trim() || command.packageName.replace(/\s/g, ""); // Removing any whitespaces
        logger.debug("branchName: ", branchName);
        let filesToIgnoreList;
        let packagePath = "";
        const moduleName = command.moduleName?.trim() || "force-app";
        authService
            .loginWithCreds(command.username.trim(), command.password.trim(), command.type.trim())
            .then((connection) => {
                // set the url configuration, required in case of running sfdx commands with access token
                shellJS.exec(`sfdx force:config:set instanceUrl=${connection.instanceURL} --global`);
                if (command.projectLocation) {
                    workingDirectory = command.projectLocation;
                }
                return retrieveService.retrievePackage(command.packageName, workingDirectory, connection.accessToken);
            })
            .then((packageLocation) => {
                packagePath = packageLocation;
                return retrieveService.findFilesToBeIgnoredWhileCopying(packagePath, workingDirectory);
            })
            .then((filesToIgnore) => {
                filesToIgnoreList = filesToIgnore;
                return retrieveService.convertToSourceInDefaultDestination(packagePath);
            })
            .then((convertedSrcPath) =>
                retrieveService.handleSpecialMerge(workingDirectory, convertedSrcPath, moduleName)
            )
            .then((convertedSrcPath) =>
                retrieveService.mergeToSource(convertedSrcPath, command.moduleName, filesToIgnoreList)
            )
            .then((message) => logger.debug(message)) // TODO: handle special metadata like workflows and custom labels
            .catch((error) => {
                console.error("retrieve.js: ", error);
                process.exit(1);
            });
    });

program
    .command("mdapi-format")
    .description("Retrieve unmanaged/managed package or a chageset in mdapi format")
    .option("-u --username <name>", "Username of org to retrieve from")
    .option("-s --password <password>", "Password of org to retrieve from")
    .option("-t --type <type>", "Type of target org")
    .option("-p --projectLocation <package>", "Location of the project, default is the current directory")
    .option("-d --srcDirectory <location>", "mdapi src directory name, src is default")
    .option("-b --branchName <branch>", "Name of the branch, default would be feature/<packageName>")
    .option("-n --packageName <package>", "Name of the package that needs to be retrieved")
    .action((command) => {
        const branchName = command.branchName || command.packageName.replace(/\s/g, ""); // Removing any whitespaces
        logger.debug("branchName: ", branchName);
        const srcDirectory = command.srcDirectory || "src";
        let packagePath = "";
        authService
            .loginWithCreds(command.username, command.password, command.type)
            .then((connection) => {
                // set the url configuration, required in case of running sfdx commands with access token
                shellJS.exec(`sfdx force:config:set instanceUrl=${connection.instanceURL} --global`);
                if (command.projectLocation) {
                    workingDirectory = command.projectLocation;
                }
                return retrieveService.retrievePackage(command.packageName, workingDirectory, connection.accessToken);
            })
            .then((packageLocation) => {
                packagePath = packageLocation;
                return retrieveService.findFilesToBeIgnoredWhileCopying(
                    packagePath,
                    `${workingDirectory}/${srcDirectory}`
                );
            })
            .then((filesToIgnore) =>
                retrieveService.mergePackageChanges(packagePath, `${workingDirectory}/${srcDirectory}`, filesToIgnore)
            )
            .catch((error) => {
                console.error("retrieve.js: ", error);
                process.exit(1);
            });
    });

program
    .command("refreshBranch")
    .description("Refreshes all metadata in branch from specified org for backup purposes via login credentials")
    .option("-u --username <name>", "Username of org to retrieve from")
    .option("-p --password <password>", "Password of org to retrieve from")
    .option("-t --type <type>", "Type of target org")
    .option("-s --src <src>", "Path to src folder")
    .action(async (command) => {
        try {
            logger.debug("retrieve.js :: ", "running :: ");
            const AUTH = await authService.loginWithCreds(command.username, command.password, command.type);
            shellJS.exec(`sfdx force:config:set instanceUrl=${AUTH.instanceURL} --global`);
            await retrieveService.refreshBranchFromOrg(AUTH.accessToken, command.src);
        } catch (error) {
            console.error("retrieve.js: ", error);
            process.exit(1);
        }
    });

program
    .command("fullOrg-mdapi")
    .description("Fetches all metadata from specified org for backup purposes on a specific branch")
    .option("-u --username <name>", "Username of org to retrieve from")
    .option("-p --password <password>", "Password of org to retrieve from")
    .option("-t --type <type>", "Type of target org")
    .option(
        "-r --rootdir <rootdir>",
        "Path to root directory for the MDAPI formatted folder, mostly the working directory"
    )
    .option("-f --folderpath <folderpath>", "Name/Path of the MDAPI formatted folder")
    .option("-d --deleteBackupDir <deleteBackupDir>", "Whether to keep backup folder or not")
    .option(
        "-b --backupOnBranch <backupOnBranch>",
        "Excepts a true or false, should be true if you want the changes to be committed on a branch"
    )
    .action(async (command) => {
        try {
            logger.debug("retrieve.js :: ", "running :: ");
            const mdapiFolderPath = command.folderPath || "src";
            const deleteBackupDir = command.deleteBackupDir || false;
            const backUpOnBranch = command.backUpOnBranch || true;
            const CONNECTION = await authService.loginWithCreds(command.username, command.password, command.type);
            shellJS.exec(`sfdx force:config:set instanceUrl=${CONNECTION.instanceURL} --global`);
            await retrieveService.retrieveCompleteOrg(
                CONNECTION,
                command.rootdir,
                mdapiFolderPath,
                false,
                deleteBackupDir,
                backUpOnBranch
            );
        } catch (error) {
            console.error("retrieve.js: ", error);
            process.exit(1);
        }
    });

program
    .command("fullOrg-sfdx")
    .description("Fetches all metadata from specified org for backup purposes on a specific branch")
    .option("-u --username <name>", "Username of org to retrieve from")
    .option("-p --password <password>", "Password of org to retrieve from")
    .option("-t --type <type>", "Type of target org")
    .option(
        "-r --rootdir <rootdir>",
        "Path to root directory for the SFDX formatted folder, mostly the working directory"
    )
    .option("-f --folderpath <folderpath>", "Name/Path of the SFDX formatted folder")
    .option("-d --deleteBackupDir <deleteBackupDir>", "Whether to keep backup folder or not")
    .action(async (command) => {
        try {
            logger.debug("retrieve.js :: ", "running :: ");
            const mdapiFolderPath = command.folderPath || "";
            const deleteBackupDir = command.deleteBackupDir || false;
            const CONNECTION = await authService.loginWithCreds(command.username, command.password, command.type);
            shellJS.exec(`sfdx force:config:set instanceUrl=${CONNECTION.instanceURL} --global`);
            await retrieveService.retrieveCompleteOrg(
                CONNECTION,
                command.rootdir,
                mdapiFolderPath,
                true,
                deleteBackupDir
            );
        } catch (error) {
            console.error("retrieve.js: ", error);
            process.exit(1);
        }
    });

program.parse(process.argv);

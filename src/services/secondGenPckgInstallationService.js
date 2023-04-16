const fs = require("fs-extra");
const shellJS = require("shelljs");
const type = require("type-detect");

const authenticate = require("./authenticationService");
const logger = require("../utils/logger");

const NO_INSTALLED_PACKAGE_FOUND = "No installed package found";
const NO_PACKAGE_FOUND = "No package found for installation";
const INVALID_PACKAGE = "Package mentioned for installation is invalid";
const LATEST = "LATEST";

const findInstalledPackages = (params) =>
    new Promise((resolve, reject) => {
        try {
            if (params.package) {
                logger.debug("params: ", params);
                resolve(params);
            } else {
                const commandOutput = shellJS.exec(
                    `SFDX_JSON_TO_STDOUT=true sfdx force:package:installed:list -u ${params.orgKey} --json`
                ).stdout;
                logger.debug("commandOutput: ", commandOutput);
                const parsedOutput = JSON.parse(commandOutput);
                if (type(parsedOutput.result) === "Array" && parsedOutput.result.length > 0) {
                    resolve(parsedOutput.result.find((cmp) => cmp.subscriberPackageName === params.packageName));
                } else {
                    resolve(NO_INSTALLED_PACKAGE_FOUND);
                }
            }
        } catch (error) {
            logger.error(error);
            reject(new Error(error));
        }
    });

const handlePackageUninstallation = (result, command, resolve, reject) => {
    logger.debug("type of result: ", type(result));
    logger.debug("result: ", result);
    if (result === NO_INSTALLED_PACKAGE_FOUND) {
        logger.debug("result: ", result);
        resolve("No installed package found, nothing needs to be uninstalled");
    } else {
        const packageIdentifier = command.package || result.SubscriberPackageVersionId;
        const commandOutput = shellJS.exec(
            `SFDX_JSON_TO_STDOUT=true sfdx force:package:uninstall --package ${packageIdentifier} -u ${command.orgKey}  --json -w 21`
        ).stdout;
        const parsedOutput = JSON.parse(commandOutput);
        logger.debug("parsedOutput: ", parsedOutput);
        if (parsedOutput.status === 0) {
            logger.debug(`Package with identifier ${packageIdentifier} successfully uninstalled`);
            resolve(parsedOutput);
        } else {
            logger.error("error: ", parsedOutput);
            reject(parsedOutput);
        }
    }
};

const handlePackageInstallation = (result, command, resolve, reject) => {
    logger.debug("type of result: ", type(result));
    logger.debug("result: ", result);
    if (result === NO_PACKAGE_FOUND) {
        logger.debug("result: ", result);
        reject(new Error("No valid package found, package installation can not be done"));
    } else if (result === INVALID_PACKAGE) {
        logger.debug("result: ", result);
        reject(
            new Error("Package Identifier you provided is not valid version for installation, due to low code coverage")
        );
    } else {
        const packageIdentifier = command.package.toUpperCase() !== LATEST ? command.package : result.packageId;
        const commandOutput = shellJS.exec(
            `SFDX_JSON_TO_STDOUT=true sfdx force:package:install --package ${packageIdentifier} -u ${command.orgKey}  --json --noprompt -w 21`
        ).stdout;
        const parsedOutput = JSON.parse(commandOutput);
        logger.debug("parsedOutput: ", parsedOutput);
        if (parsedOutput.status === 0) {
            logger.debug(`Package with identifier ${packageIdentifier} successfully installed`);
            resolve(parsedOutput);
        } else {
            logger.error("error: ", parsedOutput);
            reject(parsedOutput);
        }
    }
};

const uninstallPackage = (command) =>
    new Promise((resolve, reject) => {
        try {
            if (command.targetusername && command.password) {
                authenticate
                    .loginWithCreds(command.targetusername, command.password, command.envtype)
                    .then((connection) => {
                        // eslint-disable-next-line max-len
                        // set the url configuration, required in case of running sfdx commands with access token
                        shellJS.exec(`sfdx force:config:set instanceUrl=${connection.instanceURL} --global`);
                        command.orgKey = connection.accessToken;
                        return findInstalledPackages(command);
                    })
                    .then((result) => {
                        handlePackageUninstallation(result, command, resolve, reject);
                    })
                    .catch((err) => {
                        logger.error(err);
                        reject(err);
                    });
            } else {
                findInstalledPackages(command)
                    .then((result) => {
                        command.orgKey = command.targetusername;
                        handlePackageUninstallation(result, command, resolve, reject);
                    })
                    .catch((err) => {
                        logger.error(err);
                        reject(err);
                    });
            }
        } catch (error) {
            logger.error(error);
            reject(new Error(error));
        }
    });

const checkPackageValidityForInstallation = (command) =>
    new Promise((resolve, reject) => {
        if (!fs.existsSync("./sfdx-project.json")) {
            logger.error(
                "Not a valid sfdx project, make sure to include a valid sfdx-project.json file in the root of the project directory"
            );
            reject(
                new Error(
                    "Not a valid sfdx project, make sure to include a valid sfdx-project.json file in the root of the project directory"
                )
            );
        }
        const packageObj = fs.readJSONSync("./sfdx-project.json");
        logger.debug("packageObj: ", packageObj);
        const packageAliasesEntries = Object.entries(packageObj.packageAliases);
        logger.debug("packageAliasesEntries: ", packageAliasesEntries);
        let packageFound = false;
        for (let index = 0; index < packageAliasesEntries.length; index++) {
            const key = packageAliasesEntries[index][0];
            const value = packageAliasesEntries[index][1];
            logger.debug(`${key}: ${value}`);
            if (command.package === key || command.package === value) {
                command.packageId = key;
                packageFound = true;
                break;
            }
        }
        logger.debug("Out of the loop");
        if (packageFound) {
            logger.debug("packageFound: ", packageFound);
            resolve(command);
        } else {
            logger.debug("package Not Found: ", packageFound);
            resolve(INVALID_PACKAGE);
        }
    });

const findLatestValidPackage = (command) =>
    new Promise((resolve, reject) => {
        logger.debug("command.package: ", command.package);
        if (command.package.toUpperCase() === LATEST) {
            // Find the latest valid package
            if (!fs.existsSync("./sfdx-project.json")) {
                logger.error(
                    "Not a valid sfdx project, make sure to include a valid sfdx-project.json file in the root of the project directory"
                );
                reject(
                    new Error(
                        "Not a valid sfdx project, make sure to include a valid sfdx-project.json file in the root of the project directory"
                    )
                );
            }
            const packageObj = fs.readJSONSync("./sfdx-project.json");
            logger.debug("packageObj: ", packageObj);
            const packageAliasesEntries = Object.entries(packageObj.packageAliases);
            logger.debug("packageAliasesEntries: ", packageAliasesEntries);
            if (packageAliasesEntries.length > 1) {
                command.packageId = packageAliasesEntries[packageAliasesEntries.length - 1][0];
                resolve(command);
            } else {
                resolve(NO_PACKAGE_FOUND);
            }
        } else {
            resolve(checkPackageValidityForInstallation(command));
        }
    });

const installPackage = (command) =>
    new Promise((resolve, reject) => {
        try {
            if (command.targetusername && command.password) {
                authenticate
                    .loginWithCreds(command.targetusername, command.password, command.envtype)
                    .then((connection) => {
                        // eslint-disable-next-line max-len
                        // set the url configuration, required in case of running sfdx commands with access token
                        shellJS.exec(`sfdx force:config:set instanceUrl=${connection.instanceURL} --global`);
                        command.orgKey = connection.accessToken;
                        return findLatestValidPackage(command);
                    })
                    .then((result) => {
                        logger.debug("result: ", result);
                        handlePackageInstallation(result, command, resolve, reject);
                    })
                    .catch((err) => {
                        logger.error(err);
                        reject(err);
                    });
            } else {
                findLatestValidPackage(command)
                    .then((result) => {
                        handlePackageInstallation(result, command, resolve, reject);
                    })
                    .catch((err) => {
                        logger.error(err);
                        reject(err);
                    });
            }
        } catch (error) {
            logger.error(error);
            reject(new Error(error));
        }
    });

module.exports = {
    uninstallPackage,
    installPackage,
};

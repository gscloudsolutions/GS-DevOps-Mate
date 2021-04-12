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

const shellJS = require('shelljs');
const emoji = require('node-emoji');
const fs = require('fs-extra');
const path = require('path');
const zipFolder = require('zip-a-folder');

const util = require('../utils/manifestUtil');
const gitUtils = require('../utils/gitUtils');
const logger = require('../utils/logger');
const gitDiff = require('./gitDiff');
const notify = require('../utils/notificationsUtil');

const MULTI_PACKAGE_NAME = process.env.MDAPI_PACKAGE_GROUP_NAME ? process.env.MDAPI_PACKAGE_GROUP_NAME : 'metadatapackage-group';
const MDAPI_PACKAGE_NAME = process.env.MDAPI_PACKAGE_NAME ? process.env.MDAPI_PACKAGE_NAME : 'mdapiPackage';
const SLACK_WEBHOOK_URL = process.env.SLACK_NOTIFICATION_URI ? process.env.SLACK_NOTIFICATION_URI : null;

// Variable to hold the location of the project for which deployable
// metadata packages would be created or from where source
// based modular deployments take place
let projectPath = process.env.PROJECT_PATH || '.';
let projectLocation = projectPath;
logger.debug(`Code is executing in ${__dirname} directory`);
const diffProjectPath = path.join(path.dirname(__dirname), '/DiffProject');
logger.debug(`Location to store diff files, diffProjectPath: ${diffProjectPath}`);

const promiseMethod = message => new Promise((resolve) => {
    resolve(message);
});

const createPackage = (command, type, artifactCreationMethod) => {
    let { oldCommit } = command;
    const { newCommit } = command;
    if (!command.artifactsLocation) {
        logger.error('-p --artifactsLocation is a required param');
        process.exit(1);
    }
    if (command.projectLocation) {
        projectPath = command.projectLocation;
        projectLocation = command.projectLocation;
    }
    logger.debug(`${type}: `, command);
    const artifactsLocation = path.join(command.artifactsLocation, '/Artifacts');
    logger.debug(`${type}: Location to store artifacts, artifactsLocation: ${artifactsLocation}`);
    logger.debug(`${type}: command.newCommit: `, command.newCommit);
    logger.debug(`${type}: command.oldCommit: `, command.oldCommit);

    // If it is not a full deployment, then only check for deploymentInfo
    // in the target org to get the previous commit
    if (!oldCommit && newCommit) {
        logger.debug(`${type}: commit to compare to be pulled from the org`);
        const deploymentInfoPath = path.dirname(__dirname);
        logger.debug(`${type}: deploymentInfo.json path with name of the file : ${deploymentInfoPath}/deploymentInfo_${command.buildId}.json`);
        if (fs.existsSync(`${deploymentInfoPath}/deploymentInfo_${command.buildId}.json`)) {
            const deploymentInfoObject = fs.readJSONSync(`${deploymentInfoPath}/deploymentInfo_${command.buildId}.json`);
            oldCommit = deploymentInfoObject.Commit_SHA__c;
            logger.debug(`${type}: oldCommit: `, oldCommit);
        }
    }

    // prepare the package version based on old and new CommitSHAs
    logger.debug(`${type}:  Before createPackageVersion: `);
    const packageVersion = createPackageVersions(command.packageVersion, oldCommit,
        newCommit, projectLocation);
    logger.debug(`${type}:  packageVersion: `, packageVersion);

    // Create package only if it does not exists
    let packageNameWithoutVersion = type === 'source-combined' || type === 'mdapi' ? MDAPI_PACKAGE_NAME : MULTI_PACKAGE_NAME;
    if (fs.existsSync(`${artifactsLocation}/${packageNameWithoutVersion}-${packageVersion}`)) {
        // Do nothing
        logger.debug(`${packageNameWithoutVersion}-${packageVersion} Package exists`);
    } else if ((!newCommit && !oldCommit)
        || (newCommit && !command.packageVersion && !oldCommit)
        || command.full === 'true'
        || command.full === true) {
        // Both the old and new commit params if not passed
        // Or new commit is passed but there is no package version being passed and old commit is
        // not passed, this basically  signifies the command is expecting the diff based on commit SHA
        // stored in the target Org
        // Or Full flag if passed as true
        // Any of these indicates for a full package creation
        logger.debug(`${type}: Full Package creation`);
        logger.debug(`${type}: createMultipleArtifacts will be called in next line`);

        promiseMethod(`${type}`)
            .then((message) => {
                logger.debug(`${message} is being processed`);
                if (type === 'source-multi' || type === 'source-combined') {
                    return artifactCreationMethod(projectLocation, artifactsLocation, packageVersion);
                }

                return artifactCreationMethod(projectLocation, artifactsLocation, packageVersion, false);
            })
            .then((message) => {
                logger.debug(`${type}: createMultipleArtifacts: `, message);
                process.exit(0);
            })
            .catch(async (error) => {
                logger.error(`${type}: `, error);
                if(SLACK_WEBHOOK_URL) {
                    await notify.sendNotificationToSlack(SLACK_WEBHOOK_URL, error.message);
                }
                process.exit(1);
            });
    } else {
        logger.debug(`${type}: Diff Package creation`);
        projectLocation = diffProjectPath;
        logger.debug(`${type}: diffProjectPath: `, diffProjectPath);
        logger.debug(`${type}: prepareDiffProject will be called in next line`);
        logger.debug(`${type}: `, oldCommit);
        let sourceFormat = false;
        sourceFormat = type === 'source-multi' || type === 'source-combined';
        gitDiff.prepareDiffProject(projectPath,
            diffProjectPath, command.newCommit, oldCommit, sourceFormat, artifactsLocation)
            .then((message) => {
                const doGitDiff = true;
                logger.debug(`${type}: `, message);
                if (type === 'source-multi' || type === 'source-combined') {
                    logger.debug(`${type}: createMultipleArtifacts will be called in next line`);
                    return artifactCreationMethod(
                        projectLocation, artifactsLocation, packageVersion,
                    );
                }
                logger.debug(`${type}: createMDAPIPackageArtifact will be called in next line`);
                return artifactCreationMethod(
                    projectLocation, artifactsLocation, packageVersion, doGitDiff,
                );
            })
            .then((message) => {
                logger.debug(`${type}: `, message);
                process.exit(0);
            })
            .catch(async (error) => {
                logger.error(`${type}: `, error);
                if(SLACK_WEBHOOK_URL) {
                    await notify.sendNotificationToSlack(SLACK_WEBHOOK_URL, error.message);
                }
                process.exit(1);
            });
    }
};

const removeFolder = (folderName) => {
    shellJS.exec(`rm -rf ${folderName}`);
};

/**
 * @return {*}
 * @param {*} srcProjectPath
 * @param {*} locationToStoreArtifacts
 * @param packageVersion
 */
function createMultipleArtifacts(srcProjectPath,
    locationToStoreArtifacts, packageVersion) {
    // Will run if undefined i.e third argument is not passed
    return new Promise((resolve, reject) => {
        try {
            logger.debug('-----------Multiple artifacts generation------------');
            // const currentBuild = buildInfo.lastsuccessfulbuild + 1;
            logger.debug(`srcProjectPath: ${srcProjectPath}`);
            logger.debug(`locationToStoreArtifacts : ${locationToStoreArtifacts}`);

            // Reading the sfdx-project.json as the dependencies file
            if (!fs.existsSync(`${srcProjectPath}/sfdx-project.json`)) {
                logger.error('Not a valid sfdx project, make sure to include a valid sfdx-project.json file in the root of the project directory');
                process.exit(1);
            }
            const packageObj = fs.readJSONSync(`${srcProjectPath}/sfdx-project.json`);

            if (fs.existsSync(`${srcProjectPath}/tempSFDXProject`)) {
                removeFolder(`${srcProjectPath}/tempSFDXProject`);
            }

            fs.ensureDirSync(`${srcProjectPath}/tempSFDXProject`);


            const srcPath = srcProjectPath;
            logger.debug('srcPath: ', srcPath);

            // Create and write the sfdx-project.json to tempSFDXProject
            // to give it the sfdx nature so that sfdx force:source:convert
            // can work
            fs.writeJson(`${srcProjectPath}/tempSFDXProject/sfdx-project.json`, {
                packageDirectories: [{
                    path: 'tempModule',
                    default: true,
                }],
                namespace: '',
                sfdcLoginUrl: packageObj.sfdcLoginUrl,
                sourceApiVersion: packageObj.sourceApiVersion,
            }, (err) => {
                if (err) {
                    // this.ux.error(`Something went wrong ${err}`);
                    logger.error(`Something went wrong ${err}`);
                    // Delete the temporary SFDX project
                    removeFolder('tempSFDXProject');
                    reject(err);
                }
                // Looping through and copying all the modules in single
                // directory(sfdx format app aka module)
                logger.debug(emoji.emojify(':arrow_forward: Artifact creation started.......'));
                const currentVersion = packageVersion;

                logger.debug('currentVersion: ', currentVersion);
                logger.debug('packageObj.packageDirectories: ', packageObj.packageDirectories);
                packageObj.packageDirectories.forEach((element) => {
                    fs.ensureDirSync(`${srcProjectPath}/tempSFDXProject/tempModule/main/default`);
                    logger.debug(`Trying to copy from ${srcPath}/${element.path}/main/default
          to ${srcPath}/tempSFDXProject/tempModule/main/default`);
                    if (fs.existsSync(`${srcPath}/${element.path}/main/default`)) {
                        logger.debug(`${srcPath}/${element.path} exists and copying it to ${srcPath}/tempSFDXProject/tempModule/main/default`);
                        fs.copySync(`${srcPath}/${element.path}/main/default`,
                            `${srcPath}/tempSFDXProject/tempModule/main/default`);

                        if (fs.existsSync(`${srcPath}/.forceignore`)) {
                            logger.debug(`${srcPath}/.forceignore exists and  and copying it to ${srcPath}/tempSFDXProject`);
                            fs.copySync(`${srcPath}/.forceignore`,
                                `${srcPath}/tempSFDXProject/.forceignore`);
                        }

                        // Convert the source
                        logger.debug(`Converting  : ${srcPath}/${element.path}`);
                        logger.debug('Getting into Temporary SFDX Project');
                        shellJS.cd(`${srcPath}/tempSFDXProject`);
                        const currentDir = shellJS.pwd();
                        logger.debug(`Current Directory: ${currentDir}`);

                        const output = shellJS.exec('sfdx force:source:convert --json',
                            { silent: false });
                        const outputJSON = JSON.parse(output.stdout);
                        if (output.code === 1) {
                            // reject if the convert source throws error
                            removeFolder(`${srcPath}/tempSFDXProject`);
                            reject(outputJSON);
                        }
                        // Coming out of tempSFDXProject
                        logger.debug('Getting out of Temporary SFDX Project');
                        const mdapiPackageLocation = outputJSON.result.location;
                        const mdapiPackageName = path.basename(mdapiPackageLocation);
                        logger.debug('mdapiPackageName: ', mdapiPackageName);
                        // Copying the mdapi package (artifact) to the artifacts location based on environment
                        // specific config file
                        if (locationToStoreArtifacts) {
                            logger.debug(`Copying the mdapi package (artifact) to the artifacts location - ${locationToStoreArtifacts} and renaming it to have package version as well`);
                            fs.ensureDirSync(`${locationToStoreArtifacts}/${MULTI_PACKAGE_NAME}-${currentVersion}`);
                            fs.copySync(`${mdapiPackageLocation}`,
                                `${locationToStoreArtifacts}/${MULTI_PACKAGE_NAME}-${currentVersion}/${mdapiPackageName}`);
                            const moduleName = element.path.replace(/\//g, '-');
                            logger.debug('moduleName: ', moduleName);
                            fs.renameSync(`${locationToStoreArtifacts}/${MULTI_PACKAGE_NAME}-${currentVersion}/${mdapiPackageName}`,
                                `${locationToStoreArtifacts}/${MULTI_PACKAGE_NAME}-${currentVersion}/${moduleName}-${currentVersion}`);
                            logger.debug(`Renamed module: ${locationToStoreArtifacts}/${MULTI_PACKAGE_NAME}-${currentVersion}/${moduleName}-${currentVersion}`);
                        }
                    }
                });

                // Switch to the parent direcroty
                logger.debug('currentModuleDirName: ', __dirname);
                shellJS.cd(path.dirname(__dirname));
                shellJS.exec('pwd');
                // Update the build info only if the package version is not passed as a parameter
                // to the command
                // if (!packageVersion) {
                //     // Update the build info on succesful artifact creation
                //     const fileName = 'config/build.json';
                //     const fileContent = fs.readFileSync(fileName);
                //     const content = JSON.parse(fileContent);
                //     content.lastsuccessfulbuild = currentBuild;

                //     fs.writeFileSync(fileName, JSON.stringify(content, null, 2));
                //     logger.debug(JSON.stringify(content, null, 2));
                //     logger.debug(`writing to ${fileName}`);
                // }
                // Delete the temporary SFDX project
                removeFolder(`${srcPath}/tempSFDXProject`);
                logger.debug('Multiple Artifacts got created successfuly.....');

                // Create zipped versions of artifacts
                zipFolder.zipFolder(`${locationToStoreArtifacts}/${MULTI_PACKAGE_NAME}-${currentVersion}`, `${locationToStoreArtifacts}/${MULTI_PACKAGE_NAME}-${currentVersion}.zip`, (error) => {
                    if (error) {
                        logger.error('Something went wrong!', error);
                        reject(error);
                    } else {
                        logger.debug('Multiple Artifacts Zip got created successfuly.....');
                        resolve(`${MULTI_PACKAGE_NAME}.zip-${currentVersion}`);
                    }
                });
            });
        } catch (exception) {
            logger.error('Exception in packageCreationService', exception);
            // Delete the temporary SFDX project
            shellJS.exec(`rm -rf ${srcProjectPath}/tempSFDXProject`);
            reject(exception);
        }
    });
}

/**
 * @return {*}
 * @param {*} srcProjectPath
 * @param {*} locationToStoreArtifacts
 * @param {*} packageVersion
 */
function createCombinedArtifact(srcProjectPath,
    locationToStoreArtifacts, packageVersion) {
    // Will run if undefined i.e third argument is not passed
    return new Promise((resolve, reject) => {
        try {
            logger.debug('------------Combined artifacts generation----------------');
            //const currentCombinedBuild = buildInfo.lastsuccessfulcombinedbuild + 1;

            if (fs.existsSync(`${srcProjectPath}/tempSFDXProject`)) {
                removeFolder(`${srcProjectPath}/tempSFDXProject`);
            }
            fs.ensureDirSync(`${srcProjectPath}/tempSFDXProject/tempModule/main/default`);
            const srcPath = srcProjectPath;

            // Reading the sfdx-project.json as the dependencies file*/
            const packageObj = fs.readJSONSync(`${srcProjectPath}/sfdx-project.json`);

            // Looping through and copying all the modules in
            // single directory(sfdx format app aka module)
            packageObj.packageDirectories.forEach((element) => {
                logger.debug(`Trying to copy from ${srcPath}/${element.path}/main/default to ${srcPath}/tempSFDXProject/tempModule/main/default`);
                if (fs.existsSync(`${srcPath}/${element.path}/main/default`)) {
                    logger.debug(`${srcPath}/${element.path}/main/default exists  and copying it to ${srcPath}/tempSFDXProject/tempModule/main/default`);
                    fs.copySync(`${srcPath}/${element.path}/main/default`,
                        `${srcPath}/tempSFDXProject/tempModule/main/default`);
                }
            });
            if (fs.existsSync(`${srcPath}/.forceignore`)) {
                logger.debug(`${srcPath}/.forceignore exists and copying it to ${srcPath}/tempSFDXProject`);
                fs.copySync(`${srcPath}/.forceignore`,
                    `${srcPath}/tempSFDXProject/.forceignore`);
            }

            logger.debug(`Files in ${srcPath}/tempSFDXProject/tempModule/main/default`);
            shellJS.exec(`ls -a ${srcPath}/tempSFDXProject/tempModule/main/default`);

            // Create and write the sfdx-project.json to tempSFDXProject
            // to give it the sfdx nature so that sfdx force:source:convert
            // can work
            fs.writeJson(`${srcProjectPath}/tempSFDXProject/sfdx-project.json`, {
                packageDirectories: [{
                    path: 'tempModule',
                    default: true,
                }],
                namespace: '',
                sfdcLoginUrl: 'https://login.salesforce.com',
                sourceApiVersion: packageObj.sourceApiVersion,
            }, (err) => {
                if (err) {
                    logger.error(`Something went wrong ${err}`);
                    // Delete the temporary SFDX project
                    removeFolder('tempSFDXProject');
                    reject(err);
                }
                logger.debug(emoji.emojify(':arrow_forward: Artifact creation started.......'));
                // Convert the source
                shellJS.exec('pwd');
                shellJS.exec(`ls -a ${srcPath}/tempSFDXProject`);
                shellJS.cd(`${srcPath}/tempSFDXProject`);
                shellJS.exec('pwd');
                shellJS.exec(`ls -a ${srcPath}/tempSFDXProject`);
                const output = shellJS.exec('sfdx force:source:convert --json',
                    { silent: false });
                const outputJSON = JSON.parse(output.stdout);
                if (output.code === 1) {
                    removeFolder(`${srcPath}/tempSFDXProject`);
                    // reject if the convert source throws error
                    reject(outputJSON);
                }
                const mdapiPackageLocation = outputJSON.result.location;
                logger.debug('mdapiPackageLocation: ', mdapiPackageLocation);
                const mdapiPackageName = path.basename(mdapiPackageLocation);
                logger.debug('mdapiPackageLocation: ', mdapiPackageLocation);

                shellJS.exec('pwd');
                // Switch to the running project's directory
                shellJS.cd(path.dirname(__dirname));
                shellJS.exec('pwd');

                // Copying the mdapi package (artifact) to the artifacts location based on environment
                // specific config file
                const currentVersion = packageVersion;
                if (locationToStoreArtifacts) {
                    logger.debug(`Copying the mdapi package (artifact) to the artifacts location ${locationToStoreArtifacts} and renaming it to have package version as well`);
                    fs.copySync(`${mdapiPackageLocation}`,
                        `${locationToStoreArtifacts}/${mdapiPackageName}`);
                    fs.renameSync(`${locationToStoreArtifacts}/${mdapiPackageName}`,
                        `${locationToStoreArtifacts}/${MDAPI_PACKAGE_NAME}-${currentVersion}`);
                }

                // Update the build info on successful artifact creation
                logger.debug('currentModuleDirName: ', __dirname);
                shellJS.pwd();

                // if (!packageVersion) {
                //     // Update the build info on successful artifact creation
                //     const fileName = 'config/build.json';
                //     const fileContent = fs.readFileSync(fileName);
                //     const content = JSON.parse(fileContent);
                //     content.lastsuccessfulcombinedbuild = currentCombinedBuild;

                //     fs.writeFileSync(fileName, JSON.stringify(content, null, 2));
                //     logger.debug(JSON.stringify(content, null, 2));
                //     logger.debug(`writing to ${fileName}`);
                // }

                // Delete the temporary SFDX project
                removeFolder(`${srcPath}/tempSFDXProject`);
                logger.debug('Combined Artifact got created successfuly.....');

                // Create zipped versions of artifacts
                zipFolder.zipFolder(`${locationToStoreArtifacts}/${MDAPI_PACKAGE_NAME}-${currentVersion}`, `${locationToStoreArtifacts}/${MDAPI_PACKAGE_NAME}-${currentVersion}.zip`, (error) => {
                    if (error) {
                        logger.error('Something went wrong!', error);
                        reject(error);
                    } else {
                        logger.debug('Combined Artifact Zip got created successfuly.....');
                        resolve(`${MDAPI_PACKAGE_NAME}-${currentVersion}`);
                    }
                });
            });
        } catch (exception) {
            removeFolder('tempSFDXProject');
            reject(exception);
        }
    });
}

const createMDAPIPackageArtifact = (projectLocation, artifactsLocation, packageVersion,
    doGitDiff) => new Promise(
    (resolve, reject) => {
        const packageName = `${MDAPI_PACKAGE_NAME}-${packageVersion}`;
        let sourceLocation = projectLocation;
        logger.debug('', sourceLocation);

        if (doGitDiff === true || doGitDiff === 'true') {
            sourceLocation = artifactsLocation;
        }
        if (!fs.existsSync(`${sourceLocation}/src`)) {
            logger.error('Make sure there is a src folder in your repo consisting of all the metadata components');
            process.exit(1);
        }
        logger.debug('artifactsLocation:', artifactsLocation);
        fs.ensureDirSync(artifactsLocation);
        logger.debug('artifactsLocation:', artifactsLocation);


        // fs.renameSync(`${sourceLocation}/src`,
        //   `${sourceLocation}/${packageName}`);

        if (doGitDiff !== true && doGitDiff !== 'true') {
            logger.debug('Not a Diff based artifact creation');
            fs.copySync(`${sourceLocation}/src`, `${artifactsLocation}/${packageName}`);
        } else {
            fs.renameSync(`${artifactsLocation}/src`,
                `${artifactsLocation}/${packageName}`);
        }

        util.createPackageManifest(`${artifactsLocation}/${packageName}`)
            .then((message) => {
                logger.debug(message);
                zipFolder.zipFolder(`${artifactsLocation}/${packageName}`, `${artifactsLocation}/${packageName}.zip`, (error) => {
                    if (error) {
                        logger.debug('Something went wrong!', error);
                        reject(error);
                    } else {
                        logger.debug(`${packageName}.zip got created successfully.....`);
                        resolve(`${packageName}.zip`);
                    }
                });
            })
            .catch((err) => {
                logger.error(err);
                reject(err);
            });
    },
);

const createPackageVersions = (version, oldCommit, newCommit, repoPath) => {
    logger.debug('version: ', version);
    logger.debug('oldCommit: ', oldCommit);
    logger.debug('newCommit: ', newCommit);
    if (version) {
        return version;
    }
    const oldCommitSHA = oldCommit || 'start';
    const newCommitTag = newCommit || 'HEAD';
    // Find the git short hash revision
    const newCommitSHA = gitUtils.getSHARevision(repoPath, newCommitTag);
    logger.debug('newCommitSHA: ', newCommitSHA);
    return `${oldCommitSHA}-${newCommitSHA}`;
};

// Export all methods
module.exports = {
    createMultipleArtifacts,
    createCombinedArtifact,
    createMDAPIPackageArtifact,
    createPackageVersions,
    createPackage,
};

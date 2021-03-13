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
const fsExtra = require('fs-extra');
const path = require('path');

const util = require('../utils/manifestUtil');
const logger = require('../utils/logger');

const modifiedItems = [];
const renamedItems = [];
const newItems = [];
const deletedItems = [];
let extensionNamesForCmpsWithMetaFiles = [];
let metaXMLNamesForCmpsWithMetaFiles = [];

const getSFDXModulesList = (repoPath) => {
    // Reading the sfdx-project.json as the dependencies file
    const packageObj = fsExtra.readJSONSync(`${repoPath}/sfdx-project.json`);
    const modulesInfo = [];
    packageObj.packageDirectories.forEach((element) => {
        modulesInfo.push(element);
    });
    return modulesInfo;
};

const generateGitDiffList = (output) => {
    let totalDiffs = 0;
    // Splitting the git diff command's output and
    // storing the files in different lists based on the
    // type of change. A represents new file, M represents
    // the content of the file is modified/changed, various
    // versions of R like R078, R100 etc. represents rename
    // of the file either due to an actual rename or due to
    // the change in location of the file and D represents
    // files that are being removed/deleted. Please note that
    // the git diff command reports files with their relative
    // path.
    output.split('\n').forEach((element) => {
        const diffArray = element.split('\t');
        logger.debug(`diffArray: ${diffArray}`);
        const diffType = diffArray[0];
        if (diffType === 'M') {
            modifiedItems.push(diffArray[1]);
            totalDiffs += 1;
        } else if (diffType.includes('R')) {
            renamedItems.push(diffArray[2]);
            totalDiffs += 1;
        } else if (diffType === 'A') {
            newItems.push(diffArray[1]);
            totalDiffs += 1;
        } else if (diffType === 'D') {
            deletedItems.push(diffArray[1]);
            totalDiffs += 1;
        }
    });
    logger.debug('totalDiffs', totalDiffs);
    logger.debug(
        'totalDiffsToBeConsidered: ',
        modifiedItems.length
          + renamedItems.length
          + newItems.length
          + deletedItems.length,
    );
};

/**
 * @return {*}
 * @param {*} repoPath
 * @param {*} nextCommit
 * @param {*} previousCommit
 * @param {*} sfdxrepo
 */
const prepareDiffItemsList = (repoPath, nextCommit, previousCommit, sfdxrepo) => new Promise(
    (resolve, reject) => {
        try {
            logger.debug(`repoPath - ${repoPath}`);
            if (sfdxrepo === 'true' || sfdxrepo === true) {
                logger.debug('Diff for SFDX/Source format Repo');
                const modulesInfo = getSFDXModulesList(repoPath);
                logger.debug('Files and Folder before changing the directory to repo');
                shellJS.exec('ls -a');
                shellJS.cd(repoPath);
                logger.debug('Files and Folder after changing the directory to repo');
                shellJS.exec('ls -a');
                modulesInfo.forEach((element) => {
                    const diffCommand = `git diff $(git merge-base ${nextCommit} ${previousCommit}) ${nextCommit} --name-status ${element.path}`;
                    logger.debug(diffCommand);
                    const output = shellJS.exec(
                      diffCommand, { silent: false },
                    ).stdout;
                    generateGitDiffList(output);
                });
            } else {
                shellJS.cd(repoPath);
                shellJS.exec('ls -a');
                const diffCommand = `git diff $(git merge-base ${nextCommit} ${previousCommit}) ${nextCommit} --name-status`;
                logger.debug(diffCommand);
                const output = shellJS.exec(
                    diffCommand, { silent: true },
                ).stdout;
                logger.debug(`Git Diff Command Output: ${output}`);
                generateGitDiffList(output);
            }
            const allDIffComps = [...modifiedItems, ...renamedItems, ...newItems];
            if (allDIffComps.length === 0) {
                logger.debug('No diffs found, try with some other commit-SHAs or tags or try a full no-diff package creation');
                process.exit(21);
            }
            resolve('Diff Items Lists Generated Successfully');
        } catch (exception) {
            reject(exception);
        }
    },
);

const createProjectJSON = (repoPath, diffProjectPath) => new Promise((resolve, reject) => {
    try {
    // Reading the sfdx-project.json as the dependencies file
        const packageObj = fsExtra.readJSONSync(`${repoPath}/sfdx-project.json`);
        const packageDirectories = [];
        shellJS.pwd();
        // Looping over the sfdx-project.json from the repo
        packageObj.packageDirectories.forEach((element) => {
            // Considering only those modules/directories
            // that are found as part of the diff process

            if (fsExtra.existsSync(element.path)) {
                packageDirectories.push(element);
            }
            fsExtra.writeJSONSync(
                `${diffProjectPath}/sfdx-project.json`,
                {
                    packageDirectories,
                    namespace: '',
                    sfdcLoginUrl: packageObj.sfdcLoginUrl,
                    sourceApiVersion: packageObj.sourceApiVersion,
                },
                { spaces: 2 },
            );
        });
        resolve('sfdx-project.json file got created successfully.....');
    } catch (exception) {
        reject(exception);
    }
});

const copyDiffContent = (repoPath, diffProjectPath) => new Promise((resolve, reject) => {
    try {
        logger.debug('diffProjectPath: ', diffProjectPath);
        logger.debug(
            'modifiedItems: ',
            modifiedItems,
            ' length: ',
            modifiedItems.length,
        );
        logger.debug(
            'renamedItems: ',
            renamedItems,
            ' length: ',
            renamedItems.length,
        );
        logger.debug('newItems: ', newItems, ' length: ', newItems.length);
        logger.debug(
            'deletedItems: ',
            deletedItems,
            ' length: ',
            deletedItems.length,
        );
        // Combine all the items to be copied to the diff pproject
        const allDIffComps = [...modifiedItems, ...renamedItems, ...newItems];
        logger.debug(`allDIffComps length: ${allDIffComps.length}`);
        if (allDIffComps.length === 0) {
            logger.debug('No diffs found, try with some other commit-SHAs or tags or try a full no-diff package creation');
            process.exit(21);
        }
        allDIffComps.forEach((element) => {
            logger.debug(`element: ${element}`);
            // Include meta files for components like triggers, classes, VF Pages, Sites, Emails etc.
            // that do not themselves exits as -meta.xml files and thus always need one even when
            // the companion -meta.xml file is not changed (which is the case in most of the cases)
            // else source conversion in case of sfdx format repo and
            // deployments in case of MDAPI(non-sfdx) format repo will fail
            if (extensionNamesForCmpsWithMetaFiles.includes(path.extname(element))
                && path.basename(path.dirname(element)) !== 'sites') {
                logger.debug(`${element} needs special treatment as it needs it's -meta.xml file to be considered as well`);
                const metafilePath = `${element}-meta.xml`;
                logger.debug(`Copying from ${repoPath}/${metafilePath} to ${diffProjectPath}/${metafilePath}`);
                fsExtra.copySync(`${repoPath}/${metafilePath}`, `${diffProjectPath}/${metafilePath}`);
            }
            // Include files for classes, triggers, visualforce pages and vf compaonents if their
            // meta files exists, else source conversion in case of sfdx repo and
            // deployments in case of mdapi(non-sfdx) repo will fail
            if (
                element.includes('.cls-meta.xml')
          || element.includes('.trigger-meta.xml')
          || element.includes('.page-meta.xml')
          || element.includes('.component-meta.xml')
          || element.includes('.email-meta.xml') //TODO: Support this dynamically like line 192
            ) {
                const filePath = element.replace('-meta.xml', '');
                fsExtra.copySync(`${repoPath}/${filePath}`, `${diffProjectPath}/${filePath}`);
            }
            if (element.includes('.resource-meta.xml')) {
                let filePath = element.replace('.resource-meta.xml', '.resource');
                if (fsExtra.existsSync(filePath)) {
                    fsExtra.copySync(`${repoPath}/${filePath}`, `${diffProjectPath}/${filePath}`);
                }
                filePath = element.replace('.resource-meta.xml', '');
                if (fsExtra.existsSync(filePath)) {
                    fsExtra.copySync(`${repoPath}/${filePath}`, `${diffProjectPath}/${filePath}`);
                }
            }
            if (
                path.extname(element) === '.cmp'
          || element.includes('.cmp-meta.xml')
          || path.extname(element) === '.css'
          || path.extname(element) === '.design'
          || path.extname(element) === '.js'
          || path.extname(element) === '.png'
          || path.extname(element) === '.jpg' || path.extname(element) === '.html'
            ) {
                // Include the whole aura bundle or lwc bundle for change if any
                // of the file from the bundle is changed, if not included,
                // it will delete any of the existing files that are not
                // present in the bundle but in target org.
                if (path.dirname(path.dirname(element)).includes('aura')
          || path.dirname(path.dirname(element)).includes('lwc')) {
                    logger.debug('aura bundle/lwc: ', element);
                    fsExtra.copySync(
                        `${repoPath}/${path.dirname(element)}`,
                        `${diffProjectPath}/${path.dirname(element)}`,
                    );
                }
                // Copy all the contents of a static resource if it is a static resource stored as zip
                if (path.parse(element).dir.includes('staticresources')) {
                    const paths = path.parse(element).dir.split('/staticresources');
                    logger.debug(`paths during findin diff static resources: ${paths}`);
                    const staticResourceFolderName = paths[1].split('\/')[1];
                    logger.debug('staticResourceFolderName: ', staticResourceFolderName);
                    if (staticResourceFolderName) {
                        const staticResourcePath = path.join(paths[0], 'staticresources', staticResourceFolderName);
                        logger.debug('staticResourcePath: ', staticResourcePath);
                        fsExtra.copySync(
                            `${repoPath}/${staticResourcePath}`,
                            `${diffProjectPath}/${staticResourcePath}`,
                        );
                        fsExtra.copySync(
                            `${repoPath}/${staticResourcePath}.resource-meta.xml`,
                            `${diffProjectPath}/${staticResourcePath}.resource-meta.xml`,
                        );
                    }
                }
            }
            logger.debug(`Copying from ${repoPath}/${element} to ${diffProjectPath}/${element}`);
            fsExtra.copySync(`${repoPath}/${element}`, `${diffProjectPath}/${element}`);
        });
        resolve('Diff Content Copied Successfully.....');
    } catch (exception) {
        reject(exception);
    }
});

/**
 * @return {*}
 * @param {*} repoPath
 * @param {*} diffProjectPath
 * @param {*} nextCommit
 * @param {*} previousCommit
 * @param {*} sfdxrepo
 * @param {*} artifactslocation
 */
const prepareDiffProject = (
    repoPath,
    diffProjectPath, // if it is a sfdx repo
    nextCommit,
    previousCommit,
    sfdxrepo,
    artifactslocation, // if it is a non-sfdx repo
) => new Promise((resolve, reject) => {
    try {
        logger.debug('diffProjectPath: ', diffProjectPath);
        // Make sure to create the diff directory
        fsExtra.ensureDirSync(diffProjectPath);
        // Empty the diff directory from any previous run
        fsExtra.emptyDirSync(diffProjectPath);
        prepareDiffItemsList(repoPath, nextCommit, previousCommit, sfdxrepo)
            .then((message) => {
                logger.debug(`message from prepareDiffItemsList: ${message}`);
                return util.getMetadataTypesWithMetaFile();
            })
            .then((response) => {
                logger.debug('response from getMetadataTypesWithMetaFile:', response);
                extensionNamesForCmpsWithMetaFiles = response.map(element => `.${element}`);
                logger.debug('extensionNamesForCmpsWithMetaFiles: ', extensionNamesForCmpsWithMetaFiles);
                metaXMLNamesForCmpsWithMetaFiles = response.map(element => `.${element}-meta.xml`);
                logger.debug('metaXMLNamesForCmpsWithMetaFiles: ', metaXMLNamesForCmpsWithMetaFiles);
                if (sfdxrepo === 'true' || sfdxrepo === true) {
                    logger.debug('diffProjectPath: ', diffProjectPath);
                    return copyDiffContent(repoPath, diffProjectPath);
                }
                return copyDiffContent(repoPath, artifactslocation);
            })
            .then((message) => {
                logger.debug(`message from copyDiffContent: ${message}`);
                if (sfdxrepo === 'true' || sfdxrepo === true) {
                    if (fsExtra.existsSync(`${repoPath}/.forceignore`)) {
                        logger.debug('.forceignore is present, copying it');
                        fsExtra.copySync(`${repoPath}/.forceignore`, `${diffProjectPath}/.forceignore`);
                    }
                    return createProjectJSON(repoPath, diffProjectPath);
                }
                return util.createPackageManifest(artifactslocation);
            })
            .then((message) => {
                logger.debug(`message from manifest creation method: ${message}`);
                resolve('Diff Project Creation Successful.....');
            })
            .catch((error) => {
                logger.error(error);
                reject(error);
            });
    } catch (exception) {
        reject(exception);
    }
});

// Export methods
module.exports = { prepareDiffProject };

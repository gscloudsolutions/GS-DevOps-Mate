const shellJS = require('shelljs');
const fsExtra = require('fs-extra');
const emoji = require('node-emoji');
const extract = require('extract-zip');
const path = require('path');
const { readdir } = require('fs').promises;

const manifestUtil = require('../manifestUtil');
const logger = require('../utils/logger');

const workingDirectory = process.env.PROJECT_PATH || '.';
const fileExtensions = ['workflows', 'labels'];

const refreshBranchFromOrg = (accessSecret, srcDir) => new Promise((resolve, reject) => {
    try {
        shellJS.exec('pwd');
        if (srcDir[srcDir.length - 1] === '/') {
            srcDir[srcDir.length - 1] = '';
        }
        logger.debug(emoji.emojify(':rocket:  Backup Started................................... :rocket:'));
        const BACKUP_DIR = path.resolve(...[srcDir, '..', 'BackupDir']);
        logger.debug(`backup directory: ${BACKUP_DIR}`)
        fsExtra.ensureDirSync(BACKUP_DIR);
        const TARGET_USERNAME = accessSecret;
        logger.debug('about to execute: ' + `sfdx force:mdapi:retrieve -k ${srcDir}/package.xml -r ${BACKUP_DIR} -u ${TARGET_USERNAME} -w 50 --json `);
        shellJS.exec(`sfdx force:mdapi:retrieve -k ${srcDir}/package.xml -r ${BACKUP_DIR} -u ${TARGET_USERNAME} -w 50 --json `);
        logger.debug('Backup Done.....');

        logger.debug('Unzipping.....');

        const zipPath = `${path.resolve(BACKUP_DIR, 'unpackaged.zip')}`;
        logger.debug(`zip path: ${zipPath}`)
        extract(`${path.resolve(BACKUP_DIR, 'unpackaged.zip')}`,
            { dir: `${BACKUP_DIR}` },
            (err) => {
                if (err) {
                    console.error('retrieve.js: It\'s an error', err);
                    reject(err);
                } else {
                    logger.debug('retrieve.js: Unzip Successful.....');

                    // copy files over to branch
                    const copyFrom = path.join(...[BACKUP_DIR, 'unpackaged', '/*']);
                    const copyTo = path.resolve(srcDir)
                    shellJS.cp('-r', copyFrom, copyTo);
                    // remove downloaded files
                    shellJS.rm('-r', `${BACKUP_DIR}`);
                }
            });
        logger.debug('finishing up now');
    } catch (error) {
        reject(error);
    }
});

const retrievePackage = (packageName, projectPath, accessSecret) => new Promise((resolve, reject) => {
    const packageDirPath = projectPath || path.join(__dirname, 'PackageDirectory');
    logger.debug('packageDirPath: ', packageDirPath);
    fsExtra.ensureDirSync(packageDirPath);
    const sfdxCommand = `sfdx force:mdapi:retrieve -p "${packageName}" -r ${packageDirPath} -u ${accessSecret}`;
    logger.debug('sfdxCommand: ', sfdxCommand);
    shellJS.exec(sfdxCommand,
        (status, stdout, stderr) => {
            logger.debug('status: ', status);
            if (status === 0) {
                logger.debug('retrieve.js : retrievePackage: stdout: ', stdout);
                logger.debug('retrieve.js : Package Retrieved Successfully');
                // Unzip the package
                const artifactPath = path.join(packageDirPath, 'unpackaged.zip');
                //TODO - Henry: Should change out all these joins to use resolve, or else we risk having issues with relative path
                extract(`${artifactPath}`,
                    { dir: packageDirPath },
                    (err) => {
                        if (err) {
                            logger.error('retrieve.js: It\'s an error', err);
                            reject(err);
                        }
                        logger.debug('retrieve.js: Unzip Successfull.....');
                        logger.debug('retrieve.js: list everything in the artifact created');
                        shellJS.exec(`ls -a ${packageDirPath}`);
                        // Resolved with the retrieved unzipped package path
                        const unzippedPackagePath = path.join(packageDirPath, packageName);
                        logger.debug('unzippedPackagePath: ', unzippedPackagePath);
                        // remove zipped file
                        shellJS.rm('-r', `${packageDirPath}/unpackaged.zip`);
                        resolve(unzippedPackagePath);
                    });
            } else {
                logger.error('retrieve.js : retrievePackage: stderr: ', stderr);
                reject(stderr);
            }
        });
});

const convertToSource = async (retrievedPackagePath) => {
    // TODO: Exception Handling

    // Convert the mdapi folder into src format
    const output = await shellJS.exec(`SFDX_JSON_TO_STDOUT=true sfdx force:mdapi:convert -r "${retrievedPackagePath}" -d ./tmpSFDX --json`);
    logger.debug('output: ', output);
    logger.debug(`List the items in ${workingDirectory}/tmpSFDX`);
    shellJS.exec(`ls -a ${workingDirectory}/tmpSFDX`);

    shellJS.rm('-r', `${retrievedPackagePath}`);

    // return the path of this newly generated src format folder
    return `${workingDirectory}/tmpSFDX`;
};

// TODO
const mergeXMLs = async (sourceFile, destinationFile, childrenToResolve) => {
    // TODO: Exception Handling
    const sourceFileData = fsExtra.readFile(sourceFile, 'utf-8');
    logger.info('sourceFileData:');
    console.dir(sourceFileData);

    const destFileData = fsExtra.readFile(destinationFile, 'utf-8');
    logger.info('destFileData');
    console.dir(destFileData);

    // Logic to merge the JSON data

    // Logic to convert the newly created merged JSON data back to XML file

    return 'Merge Successful';
};

const mergeToSource = async (convertedSrcPath, moduleName) => new Promise((resolve, reject) => {
    // Reading the sfdx-project.json as the dependencies file*/
    const packageObj = fsExtra.readJSONSync(`${workingDirectory}/sfdx-project.json`);
    const module = moduleName || packageObj.packageDirectories[0].path;
    const source = convertedSrcPath;
    const destination = `${workingDirectory}/${module}`;
    logger.debug('source: ', source);
    logger.debug('destination: ', destination);

    // copy source folder to destination folder
    fsExtra.copy(source, destination, (err) => {
        if (err) {
            logger.error('An error occurred while copying the folder.');
            reject(err);
        }
        console.debug('Copy completed Successfully!');
        shellJS.rm('-r', `${source}`);
        resolve('Copy completed Successfully! ');
    });
});

// Source: https://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search
const getFiles = async (dir) => {
    const dirents = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
    }));
    return Array.prototype.concat(...files);
};

const findFilesToBeIgnoredWhileCopying = async (source, destination) => {
    // Fetch list of files from source and destination
    const sourceFiles = await getFiles(source);
    logger.debug('sourceFiles: ', sourceFiles);
    const destFiles = await getFiles(destination);
    logger.debug('destFiles: ', destFiles);
    // Find meta-files that need special attention while merging
    const filteredFilesFromSource = sourceFiles.filter((el) => {
        const parentDirName = path.basename(path.dirname(el));
        logger.debug('parentDirName:', parentDirName);
        return fileExtensions.includes(parentDirName);
    });
    logger.debug('filteredFilesFromSource: ', filteredFilesFromSource);
    const destFilesBaseNames = destFiles.map(element => path.basename(element));
    logger.debug('destFilesBaseNames: ', destFilesBaseNames);
    return filteredFilesFromSource.filter(el => destFilesBaseNames.includes(path.basename(el)));
};

const mergePackageChanges = (source, destination, filesToIgnore) => new Promise((resolve, reject) => {
    logger.debug('source: ', source);
    logger.debug('destination: ', destination);
    logger.debug('filesToIgnore: ', filesToIgnore);
    const filterFunction = (src) => {
        logger.debug('src: ', src);
        return !filesToIgnore.includes(src);
    };

    // copy source folder to destination folder
    fsExtra.copy(source, destination, { filter: filterFunction }, (err) => {
        if (err) {
            logger.error('An error occurred while copying the folder.');
            reject(err);
        }
        console.debug('Copy completed Successfully!');
        shellJS.rm('-r', `${source}`);
        resolve('Copy completed Successfully! ');
    });
});

const retrieveCompleteOrg = (conn, rootdir, cmpsFolderPath, srcFormat, deleteBackupDir, backUpOnBranch) => new Promise((resolve, reject) => {
    try {
        const BACKUP_DIR = `${rootdir}/BackupDir`;
        fsExtra.ensureDirSync(BACKUP_DIR);
        shellJS.exec('pwd');
        logger.debug(emoji.emojify(':rocket:  Backup Started................................... :rocket:'));

        // Generating a unique string for backupfolder name
        // const epochTime = Math.floor(new Date() / 1000);
        manifestUtil.createPackageManifest(BACKUP_DIR, true, conn)
            .then((message) => {
                logger.debug(message);
                const packageXMLPath = path.join(BACKUP_DIR, 'package.xml');
                if (srcFormat) {
                    if (!fsExtra.existsSync('sfdx-project.json')) {
                        // Create an SFDX project // TODO: Error Handling for all these sfdx execute command
                        logger.debug('Project Creation Started');
                        shellJS.exec('sfdx force:project:create -n temp -t empty');
                        logger.debug('Project Creation Finished');
                        shellJS.cp(path.join(...[rootdir, 'temp', 'sfdx-project.json']), path.join(...[rootdir, cmpsFolderPath]));
                        shellJS.rm('-r', path.join(...[rootdir, 'temp']));
                    }
                    fsExtra.ensureDirSync(path.join(rootdir, 'force-app'));
                    logger.debug('Project Retrieval Started');
                    shellJS.exec(`sfdx force:source:retrieve -x ${packageXMLPath} -u ${conn.accessToken} --json -w 51`);
                    logger.debug('Project Retrieval Finished');
                } else {
                    shellJS.exec(`sfdx force:mdapi:retrieve -k ${packageXMLPath} -r ${BACKUP_DIR} -u ${conn.accessToken} -w 51 --json`);

                    //TODO - Henry: Should change out all these joins to use resolve, or else we risk having issues with relative path
                    extract(`${path.join(BACKUP_DIR, 'unpackaged.zip')}`,
                        { dir: `${BACKUP_DIR}` },
                        (err) => {
                            if (err) {
                                console.error('retrieve.js: It\'s an error', err);
                                reject(err);
                            }
                            logger.debug('retrieve.js: Unzip Successful.....');
                            logger.debug('retrieve.js: list everything in the artifact created');
                            if (backUpOnBranch) {
                                const repoPathToCopy = path.join(rootdir, cmpsFolderPath);
                                fsExtra.ensureDirSync(repoPathToCopy);
                                shellJS.cp('-r', path.join(...[BACKUP_DIR, 'unpackaged', '/*']), repoPathToCopy);
                            }
                            if (deleteBackupDir) {
                                shellJS.rm('-r', `${BACKUP_DIR}`);
                            }
                        });
                }

                logger.debug('finishing up now');
                resolve('Backup Done.....');
            })
            .catch((error) => {
                reject(error);
            });
    } catch (error) {
        reject(error);
    }
});

// Export methods
module.exports = {
    retrieveCompleteOrg,
    refreshBranchFromOrg,
    retrievePackage,
    convertToSource,
    mergeToSource,
    findFilesToBeIgnoredWhileCopying,
    mergePackageChanges,
};

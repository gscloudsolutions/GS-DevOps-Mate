const shellJS = require('shelljs');
const fsExtra = require('fs-extra');
const emoji = require('node-emoji');
const extract = require('extract-zip');
const path = require('path');
const { readdir } = require('fs').promises;
const util = require('util');
const parseString = require("xml2js").parseString;
const parseStringPromise = require("xml2js").parseStringPromise;
const xml2js = require("xml2js");
const type = require('type-detect');
const builder = new xml2js.Builder();

const manifestUtil = require('../utils/manifestUtil');
const logger = require('../utils/logger');
const { fs } = require('@salesforce/core');

const workingDirectory = process.env.PROJECT_PATH || '.';
const fileExtensions = ['workflows', 'labels'];
const specialMetadataMap = {
    Workflow: {
        suffix: "workflow",
        directoryName: "workflows"
    },
    CustomLabels: { 
        suffix: "labels",
        directoryName: "labels"
    }
};

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
                    logger.error('retrieve.js: It\'s an error', err);
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

const getElligibleMetadataFiles = async (folderPath)  => {
    const files = await getFiles(folderPath);
    logger.debug('files: ', files);
    // Find meta-files that need special attention while merging
    const filteredFilesFromSource = files.filter((el) => {
        const parentDirName = path.basename(path.dirname(el));
        logger.debug('parentDirName:', parentDirName);
        return fileExtensions.includes(parentDirName);
    });
   
    return filteredFilesFromSource;
}

const handleSpecialMerge =  async(workingDirectory, convertedSrcPath, sfdxModuleName) => {
    // Create a list of elligible metadata files from the retrieved ones
    const elligibleRetrievedMDFilesWithFullPath = await getElligibleMetadataFiles(convertedSrcPath);
    logger.debug('elligibleRetrievedMDFilesWithFullPath', elligibleRetrievedMDFilesWithFullPath);
    
    const elligibleRetrievedMDFileNames = elligibleRetrievedMDFilesWithFullPath.map(filePath => path.basename(filePath));
    logger.debug('elligibleRetrievedMDFileNames', elligibleRetrievedMDFileNames);
    
    const allFilesInWorkingDirWithFullPath = await getFiles(workingDirectory);
    logger.debug('allFilesInWorkingDirWithFullPath', allFilesInWorkingDirWithFullPath)
    const elligibleMDFilesWithFullPathFromWorkingDir = allFilesInWorkingDirWithFullPath.filter((filePath) => {
        return ( elligibleRetrievedMDFileNames.includes(path.basename(filePath)) && 
        !elligibleRetrievedMDFilesWithFullPath.includes(filePath));
    });
    logger.debug('elligibleMDFilesWithFullPathFromWorkingDir', elligibleMDFilesWithFullPathFromWorkingDir);
    
    // Create two temporary folders and copy the elligible metadata files
    // from working directory and retrieved src into them respectively
    // based on the file names from step 1
    const tempFolderPathForRetrievedFiles = path.join(workingDirectory, 'tmpMergeFolderSrc');
    logger.debug('tempFolderPathForRetrievedFiles', tempFolderPathForRetrievedFiles);
    if(!fsExtra.existsSync(tempFolderPathForRetrievedFiles)) {
        fsExtra.mkdirSync(tempFolderPathForRetrievedFiles);
    }
    elligibleRetrievedMDFilesWithFullPath.forEach(filePath => {
        const filePathName = path.join(tempFolderPathForRetrievedFiles, path.basename(filePath));
        fsExtra.copyFileSync(filePath, filePathName);
    });

    const tempFolderPathForWorkingDirFiles = path.join(workingDirectory, 'tmpMergeFolderDest');
    logger.debug('tempFolderPathForWorkingDirFiles', tempFolderPathForWorkingDirFiles);
    
    if(!fsExtra.existsSync(tempFolderPathForWorkingDirFiles)) {
        fsExtra.mkdirSync(tempFolderPathForWorkingDirFiles);
    }
    elligibleMDFilesWithFullPathFromWorkingDir.forEach(filePath => {
        const filePathName = path.join(tempFolderPathForWorkingDirFiles, path.basename(filePath));
        fsExtra.copyFileSync(filePath, filePathName);
    });
    
    const tFPRF = await getFiles(tempFolderPathForRetrievedFiles);
    logger.debug('Files in tempFolderPathForRetrievedFiles', tFPRF);
    const tFPFWF = await getFiles(tempFolderPathForWorkingDirFiles);
    logger.debug('Files in tempFolderPathForWorkingDirFiles', tFPFWF);
    
    const srcFormatPathForRetrievedFiles = path.join(workingDirectory, 'tmpMergeFolderSrc', 'srcFormat');
    const srcFormatPathForWDFiles = path.join(workingDirectory, 'tmpMergeFolderDest', 'srcFormat');
    const mdFormatPathForMergedFiles = path.join(workingDirectory, 'tmpMergeFolderDest', 'mdFormat');
    if(!fsExtra.existsSync(srcFormatPathForRetrievedFiles)) {
        fsExtra.mkdirSync(srcFormatPathForRetrievedFiles);
    }

    if(!fsExtra.existsSync(srcFormatPathForWDFiles)) {
        fsExtra.mkdirSync(srcFormatPathForWDFiles);
    }

    if(!fsExtra.existsSync(mdFormatPathForMergedFiles)) {
        fsExtra.mkdirSync(mdFormatPathForMergedFiles);
    }

    // Convert these files from the temp folders into custom-sfdx format
    await convertToRealSFDXFormat(tFPRF, srcFormatPathForRetrievedFiles);
    await convertToRealSFDXFormat(tFPFWF, srcFormatPathForWDFiles);

    // Copy the files from tmpMergeFolderSrc/srcFormat to tmpMergeFolderDest/srcFormat
    fsExtra.copySync( srcFormatPathForRetrievedFiles, 
        srcFormatPathForWDFiles );
    const sFPRF = await getFiles(srcFormatPathForRetrievedFiles);
    logger.debug('srcFormatPathForRetrievedFiles', sFPRF);
    const sfPWF = await getFiles(srcFormatPathForWDFiles);
    logger.debug('srcFormatPathForWDFiles', sfPWF);
    // Convert the the new version of folders back into their usual mdapi format
    await convertToMDAPIFormat( srcFormatPathForWDFiles, 
        mdFormatPathForMergedFiles,
        sfdxModuleName );

    const mergedFiles = await getFiles(mdFormatPathForMergedFiles);
    logger.debug('mergedFiles', mergedFiles);
    
    // const sfdxFormatPath = path.join(workingDirectory, 'tmpMergeFolderDest', 'sfdxFormat')
    // if(!fsExtra.existsSync(sfdxFormatPath)) {
    //     fsExtra.mkdirSync(sfdxFormatPath);
    // }
    // await convertToSource(mdFormatPathForMergedFiles, sfdxFormatPath);

    // Copy back to working directory
    fsExtra.copySync( mdFormatPathForMergedFiles, 
        workingDirectory, {overwrite: true} );

    // Delete the tmp directories
    fsExtra.removeSync(tempFolderPathForRetrievedFiles);
    fsExtra.removeSync(tempFolderPathForWorkingDirFiles);
    
    return convertedSrcPath;
}

const convertToSourceInDefaultDestination = async (source) => {
    return await convertToSource(source, './tmpSFDX');
}

const convertToSource = async (source, destination) => {
    // TODO: Exception Handling

    // Convert the mdapi folder into src format
    const output = await shellJS.exec(`SFDX_JSON_TO_STDOUT=true sfdx force:mdapi:convert -r "${source}" -d ${destination} --json`);
    logger.debug('output: ', output);
    logger.debug(`List the items in ${workingDirectory}/${destination}`);
    shellJS.exec(`ls -a ${workingDirectory}/${destination}`);

    shellJS.rm('-r', `${source}`);

    // return the path of this newly generated src format folder
    return `${workingDirectory}/${destination}`;
};

// TODO
const mergeXMLs = async (sourceFile, destinationFile, childrenToResolve) => {
    // TODO: Exception Handling
    const sourceFileData = fsExtra.readFile(sourceFile, 'utf-8');
    logger.info('sourceFileData:');
    logger.dir(sourceFileData);

    const destFileData = fsExtra.readFile(destinationFile, 'utf-8');
    logger.info('destFileData');
    logger.dir(destFileData);

    // Logic to merge the JSON data

    // Logic to convert the newly created merged JSON data back to XML file

    return 'Merge Successful';
};

const mergeToSource = async (convertedSrcPath, moduleName, filesToIgnore) => new Promise((resolve, reject) => {
    // Reading the sfdx-project.json as the dependencies file*/
    const packageObj = fsExtra.readJSONSync(`${workingDirectory}/sfdx-project.json`);
    const module = moduleName || packageObj.packageDirectories[0].path;
    const source = convertedSrcPath;
    const destination = `${workingDirectory}/${module}`;
    logger.debug('source: ', source);
    logger.debug('destination: ', destination);
    logger.debug('filesToIgnore: ', filesToIgnore);
    

    const filterFunction = (src) => {
        logger.debug('src: ', src);
        return !filesToIgnore.includes(path.basename(src));
    };

    // copy source folder to destination folder
    fsExtra.copy(source, destination, { filter: filterFunction }, (err) => {
        if (err) {
            logger.error('An error occurred while copying the folder.');
            reject(err);
        }
        logger.debug('Copy completed Successfully!');
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
    return filteredFilesFromSource.filter(el => destFilesBaseNames.includes(path.basename(el))).map(file => path.basename(file)+'-meta.xml');
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
        logger.debug('Copy completed Successfully!');
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
                                logger.error('retrieve.js: It\'s an error', err);
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

const promisifiedParseString = (data) => {
    return new Promise((resolve, reject) => {
        parseString(data, function(err, result) {
            if (err) {
                logger.debug(err);
                reject(err);
            };
            resolve(result);
        });
    });
} 

const convertToRealSFDXFormat =  async (files, destination) => {
        let topLevelName = '';
        for(index = 0; index < files.length; index++) {
            try {
                topLevelName = path.basename(path.basename(files[index], '.xml'), path.extname(path.basename(files[index], '.xml')));
                logger.debug('topLevelName: ', topLevelName);
                // Top Level name would not be ther for Custom Labels
                if(topLevelName === 'CustomLabels') {
                    topLevelName = '';
                }
                data = await fsExtra.readFile(files[index], "utf-8");  
                logger.debug('data: ', data);
                result = await promisifiedParseString(data);
                logger.debug('result: ', result);
                for(let rootElement in result) {
                    logger.debug('rootElement: ', rootElement);
                    for(let firstLevelElmnt in result[rootElement]) {
                        logger.debug('firstLevelElmnt Name: ', firstLevelElmnt);
                        logger.debug('type of firstLevelElmnt value is: ', type(result[rootElement][firstLevelElmnt]));
                        if(type(result[rootElement][firstLevelElmnt]) === 'Array') {
                            logger.debug('firstLevelElmnt Array length: ', result[rootElement][firstLevelElmnt].length);
                            for (element in result[rootElement][firstLevelElmnt]) {
    
                                let elementName = result[rootElement][firstLevelElmnt][element].fullName[0];
                                logger.debug('element name: ', elementName);
    
                                //firstLevelElementSingular = pluralize.singular(firstLevelElmnt);
                                let jsonReadyForXMl = {};
                                //jsonReadyForXMl[firstLevelElementSingular] = result[rootElement][firstLevelElmnt][element];
                                let rootElementName = rootElement;
                                if(topLevelName) {
                                    rootElementName = `${topLevelName}.${rootElement/*.toLowerCase()*/}`
                                }
                                jsonReadyForXMl[firstLevelElmnt] = result[rootElement][firstLevelElmnt][element];
                                fsExtra.ensureFileSync(`${destination}/${rootElementName}/${firstLevelElmnt}/${elementName}.xml`);
                                logger.debug(jsonReadyForXMl);
                                // Prepare an individual element xml
                                let xml = builder.buildObject(jsonReadyForXMl);
    
    
                                await fsExtra.writeFile(`${destination}/${rootElementName}/${firstLevelElmnt}/${elementName}.xml`, xml); 
                                logger.debug("successfully written our update xml to file");
                            }
                        }
    
                    }
                }
            } catch(error) {
                logger.error(error);
                return 'Conversion to custom sfdx format failed'
            }
        }
};

const convertToMDAPIFormat = async (folderPath, destination, sfdxModuleName) => {

    //Make a list of top level directories

    const topLevelDirectories = await readdir(folderPath, { withFileTypes: true });
    logger.debug('topLevelDirectories: ', topLevelDirectories);

    //Loop over them, add them to an object for XML  and get a list of child directories
    for(let index = 0; index < topLevelDirectories.length; index++) {
        let dirent = topLevelDirectories[index];
        logger.debug(dirent.name);

        const firstLevelChildDirs = fsExtra.readdirSync(`${folderPath}/${dirent.name}`);
        logger.debug(firstLevelChildDirs);
        let objectForXML = {};
        let rootName = dirent.name;
        let cmpName = dirent.name;
        if (dirent.name.split('.').length > 1 ) {
            cmpName = dirent.name.split('.')[0];
            rootName = dirent.name.split('.')[1];
        }
        objectForXML[rootName] = {'$': {
                'xmlns': 'http://soap.sforce.com/2006/04/metadata'
            }};
        for(let childIndex = 0; childIndex < firstLevelChildDirs.length; childIndex++) {
            let flc = firstLevelChildDirs[childIndex];
            const files = fsExtra.readdirSync(`${folderPath}/${dirent.name}/${flc}`);
            objectForXML[rootName][flc] = [];
            logger.debug('objectForXML:', objectForXML);
            const resultArray = [];
            logger.debug('files: ',files);
            
            for(let index =0; index <files.length; index++) {
                const data = fsExtra.readFileSync(`${folderPath}/${dirent.name}/${flc}/${files[index]}`, "utf-8");
                const result = await parseStringPromise(data);
                logger.debug('result: ', result);
                resultArray.push(result[flc]);
                logger.debug('dirent.name', dirent.name);
            }
            logger.debug('rootName: ', rootName);
            logger.debug('flc: ', flc);
            logger.debug('resultArray: ', resultArray);
            
            objectForXML[rootName][flc] = resultArray;
            logger.debug('objectForXML: ', objectForXML);
            
            const xml = builder.buildObject(objectForXML);
            logger.debug('xml: ', xml);
            logger.debug(`${destination}/${dirent.name}.xml`);
            
            const cmpFileName = cmpName?`${cmpName}.${specialMetadataMap[rootName].suffix}-meta.xml`:
                `${specialMetadataMap[rootName].suffix}-meta.xml`  
            logger.debug('cmpFileName: ', cmpFileName);
            logger.debug('cmpFileName path: ', path.join(destination, sfdxModuleName, 'main', 
            'default', specialMetadataMap[rootName].directoryName));

            fsExtra.ensureFileSync(path.join(destination, sfdxModuleName, 'main', 
                'default', specialMetadataMap[rootName].directoryName,
                cmpFileName));
            fsExtra.writeFileSync(path.join(destination, sfdxModuleName, 'main', 
                'default', specialMetadataMap[rootName].directoryName,
                cmpFileName), xml);
        }
    }
    logger.debug('destination: ', destination);
    const files = await getFiles(destination);
    logger.debug('files: ', files);    
};

// Export methods
module.exports = {
    retrieveCompleteOrg,
    refreshBranchFromOrg,
    retrievePackage,
    convertToSource,
    convertToSourceInDefaultDestination,
    mergeToSource,
    findFilesToBeIgnoredWhileCopying,
    mergePackageChanges,
    handleSpecialMerge
};



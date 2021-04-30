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
const recursive = require('recursive-readdir');
const shellJS = require('shelljs');
const builder = require('xmlbuilder');
const fsExtra = require('fs-extra');
const path = require('path');
const util = require('util');

const logger = require('./logger');

let metadataMappings = require('../../config/describeMetadata.json');

const ignoreMetadataListFileName = process.env.MDT_IGNORE_FILE || 'ignoreMetadataList.json';
const IGNORE_NAMESPACED_CMPS = process.env.IGNORE_NAMESPACED_CMPS || false;

const getMetadataTypesToIgnore = backupDirPath => new Promise((resolve, reject) => {
    try {
        const srcDirectoryPath = path.dirname(backupDirPath);
        logger.debug('srcDirectoryPath: ', srcDirectoryPath);
        const ignoreMetadataListFilePath = path.join(srcDirectoryPath, ignoreMetadataListFileName);
        logger.debug('ignoreMetadataListFilePath: ', ignoreMetadataListFilePath);
        let ignoreFilesList = [];
        if (fsExtra.existsSync(ignoreMetadataListFilePath)) {
            const ignoreFilesObject = fsExtra.readJSONSync(ignoreMetadataListFilePath);
            if (ignoreFilesObject && ignoreFilesObject.list && ignoreFilesObject.list.length > 0) {
                ignoreFilesList = [...ignoreFilesObject.list];
            }
        }
        logger.debug(ignoreFilesList);
        resolve(ignoreFilesList);
    } catch (error) {
        reject(error);
    }
});

const getMetadataFilesToIgnore = backupDirPath => new Promise((resolve, reject) => {
    try {
        const srcDirectoryPath = path.dirname(backupDirPath);
        logger.debug('srcDirectoryPath: ', srcDirectoryPath);
        const ignoreMetadataListFilePath = path.join(srcDirectoryPath, ignoreMetadataListFileName);
        logger.debug('ignoreMetadataListFilePath: ', ignoreMetadataListFilePath);
        let ignoreFilesList = [];
        if (fsExtra.existsSync(ignoreMetadataListFilePath)) {
            const ignoreFilesObject = fsExtra.readJSONSync(ignoreMetadataListFilePath);
            if (ignoreFilesObject && ignoreFilesObject.filenames && ignoreFilesObject.filenames.length > 0) {
                ignoreFilesList = [...ignoreFilesObject.filenames];
            }
        }
        logger.debug(ignoreFilesList);
        resolve(ignoreFilesList);
    } catch (error) {
        reject(error);
    }
});

const fetchMetadataMappings = (authTokenOrAlias, latestAPIVersion) => new Promise((resolve, reject) => {
    try {
        logger.debug('Fetching Metadata Types from org......');
        logger.debug('Current directory printed on next line: ');
        shellJS.exec('pwd');
        shellJS.exec(`sfdx force:mdapi:describemetadata -u ${authTokenOrAlias} --json -f ./config/describeMetadata.json`);
        logger.debug('Metadata Types Fetching done');
        const fileContent = fsExtra.readFileSync('./config/describeMetadata.json');
        metadataMappings = JSON.parse(fileContent);
        metadataMappings.latestAPIVersion = latestAPIVersion;
        const jsonString = JSON.stringify(metadataMappings, null, 2);
        const filePathForJSON = './config/describeMetadata.json';
        fsExtra.writeFileSync(filePathForJSON, jsonString);
        resolve('MetadataMappings populated successfully');
    } catch (error) {
        reject(error);
    }
});

const getMetadataTypesWithoutSuffix = () => new Promise((resolve, reject) => {
    try {
        resolve(metadataMappings.metadataObjects.filter((element) => {
            if (!element.suffix) {
                return element.directoryName;
            }
        }).map(element => element.directoryName));
    } catch (exception) {
        reject(exception);
    }
});

const getMetadataTypesWithFolder = () => new Promise((resolve, reject) => {
    try {
        resolve(metadataMappings.metadataObjects.filter((element) => {
            if (element.suffix && element.inFolder === true) {
                return element.suffix;
            }
        }).map(element => element.suffix));
    } catch (exception) {
        reject(exception);
    }
});

const getMetadataTypesWithMetaFile = () => new Promise((resolve, reject) => {
    try {
        resolve(metadataMappings.metadataObjects.filter((element) => {
            if (element.suffix && element.metaFile === true) {
                return element.suffix;
            }
        }).map(element => element.suffix));
    } catch (exception) {
        reject(exception);
    }
});

const createExtensionToCmpNameMap = projectPath => new Promise((resolve, reject) => {
    const extensionToCmpName = new Map();
    let metadataTypesWithoutSuffix = [];
    let metadataTypesWithFolder = [];
    getMetadataTypesWithFolder()
        .then((metadataListWithFolder) => {
            metadataTypesWithFolder = metadataListWithFolder;
            logger.debug('metadataListWithFolder: ', metadataListWithFolder);
            return getMetadataTypesWithoutSuffix();
        })
        .then((metadataListWithoutSuffix) => {
            logger.debug('metadataListWithoutSuffix: ', metadataListWithoutSuffix);
            metadataTypesWithoutSuffix = metadataListWithoutSuffix;
            return recursive(projectPath, ['*.xml', '.DS_Store']);
        }) // TODO: Get Metadata Types with Folder
        .then((files) => {
            logger.debug('Length of the diff files array: ', files.length);
            files.forEach((element) => {
                logger.debug('file path: ', element);
                logger.debug('Base Name: ', path.basename(element));
                const directoryName = path.basename(path.dirname(element));
                logger.debug('Parent Folder Name: ', directoryName);
                let extension = path.extname(element).replace('\.', '');
                let elementName = path.parse(element).name;
                if (!extensionToCmpName.has(extension)) {
                    extensionToCmpName.set(extension, []);
                }
                // Takes care of metadata like LWCs and Aura
                if (metadataTypesWithoutSuffix
                    .includes(path.basename(path.dirname(path.dirname(element))))) {
                    logger.debug('file path for a bundle:', element);
                    extension = path.basename(path.dirname(path.dirname(element)));
                    logger.debug('Extension for a bundle:', extension);
                    elementName = path.parse(path.dirname(element)).name;
                    if (!extensionToCmpName.has(extension)) {
                        extensionToCmpName.set(extension, []);
                    }
                    logger.debug('Bundle Name:', elementName);
                }

                // Takes care of metadata like Dashboards, Emailtemplates, Reports, Site and SiteDotCom
                if (metadataTypesWithFolder.includes(extension) || path.extname(element) === '.site') {
                    logger.debug('file path for the folder/site component: ', element);
                    logger.debug('extension :', extension);
                    const mainElementName = path.parse(element).name;
                    logger.debug('mainElementName :', mainElementName);
                    const parentFolderName = path.basename(path.dirname(element));
                    logger.debug('parentFolderName :', parentFolderName);
                    elementName = path.join(parentFolderName, mainElementName);
                    if (parentFolderName === 'siteDotComSites') {
                        extension = 'SiteDotCom';
                        elementName = mainElementName;
                    }
                    if (parentFolderName === 'sites') {
                        extension = 'CustomSite';
                        elementName = mainElementName;
                    }
                    if (!extensionToCmpName.has(extension)) {
                        extensionToCmpName.set(extension, []);
                    }
                }

                // Takes care of metadata related to territories
                if (path.extname(element) === '.territory2Rule'
        || path.extname(element) === '.territory2') {
                    const dirName = path.basename(path.dirname(path.dirname(element)));
                    elementName = `${dirName}.${elementName}`;
                }
                logger.debug('elementName: ', elementName);
                if (!extensionToCmpName.get(extension).includes(elementName)) {
                    extensionToCmpName.get(extension).push({ elementName, directoryName });
                }
            });
            logger.debug('extensionToCmpName created successfully.....');
            resolve(extensionToCmpName);
        })
        .catch((error) => {
            reject(error);
        });
});

const getMetaDataInfoList = () => new Promise((resolve, reject) => {
    try {
        resolve(metadataMappings.metadataObjects);
    } catch (exception) {
        reject(exception);
    }
});

const chunkArray = (myArray, chunkSize) => {
    const results = [];
    while (myArray.length) {
        results.push(myArray.splice(0, chunkSize));
    }
    return results;
};

// A method to list all the metadata inside of an org
const listAllMetadata = async (conn, backupDirPath) => {
    try {
        const con = conn;
        const folderTypes = [];
        const fileTypesToIgnore = await getMetadataTypesToIgnore(backupDirPath);
        logger.debug('fileTypesToIgnore: ', fileTypesToIgnore);
        const manifestVersion = process.env.MANIFEST_VERSION || metadataMappings.latestAPIVersion;
        await fetchMetadataMappings(conn.accessToken, manifestVersion); // TODO: Support for check if already exists for the target org version
        const metadataTypes = metadataMappings.metadataObjects.map((element) => {
            if (fileTypesToIgnore.length === 0 || !fileTypesToIgnore.includes(element.xmlName)) {
                if (!element.inFolder) {
                    return { type: element.xmlName };
                } if (element.inFolder && element.xmlName === 'EmailTemplate') {
                    folderTypes.push('EmailFolder');
                    return { type: 'EmailFolder' };
                }
                folderTypes.push(`${element.xmlName}Folder`);
                return { type: `${element.xmlName}Folder` };// ReportFolder, DashboardFolder, DocumentFolder
            }
        });
        logger.debug(`metadataTypes: ${metadataTypes}`);
        const filteredMTs = metadataTypes.filter(element => element);
        const result = chunkArray(filteredMTs, 3);
        logger.debug(`chunkArray result: ${result}`);
        const promises = [];

        result.forEach((types) => {
            promises.push(con.metadata.list(types, manifestVersion));
        });
        const metadata = await Promise.all(promises);

        logger.debug(`metadata list length: ${metadata.length}`);
        logger.debug(`metadata list: ${metadata}`);
        let flattenedMetadataList = metadata.flat(1);
        logger.debug(`metadata list length: ${flattenedMetadataList.length}`);
        logger.debug(`flattenedMetadataList: ${flattenedMetadataList}`);
        logger.debug('Types: ', util.inspect(flattenedMetadataList, { maxArrayLength: null }));
        // To list folder based metadata
        const installedPackageCmps = flattenedMetadataList.filter(component => (component && (component.namespacePrefix !== '' || component.manageableState === 'installed')));
        logger.info('Number of cmps/metadata from installed packages: ', installedPackageCmps.length);
        const unmanagedCmps = flattenedMetadataList.filter(component => (component && (component.namespacePrefix === '' || component.manageableState === 'unmanaged')));
        logger.info('Number of unmanaged cmps/metadata: ', unmanagedCmps.length);
        if(IGNORE_NAMESPACED_CMPS === true || IGNORE_NAMESPACED_CMPS === 'true') {
            flattenedMetadataList = unmanagedCmps;
        }

        const folderCmps = flattenedMetadataList.filter(component => (component && folderTypes.includes(component.type)));
        

        const folderBasedMetadata = folderCmps.map((component) => {
            if (component.type === 'EmailFolder') {
                return { type: 'EmailTemplate', folder: component.fullName };
            }
            return { type: component.type.replace('Folder', ''), folder: component.fullName };
        });
        const chunkedFolderBasedMetadata = chunkArray(folderBasedMetadata, 3);
        logger.debug(`chunkArray chunkedfolderBasedMetadata: ${chunkedFolderBasedMetadata}`);
        const promisesForFolderMDT = [];
        chunkedFolderBasedMetadata.forEach((types) => {
            promisesForFolderMDT.push(con.metadata.list(types, manifestVersion));
        });
        const folderMetadata = await Promise.all(promisesForFolderMDT);
        logger.debug(`metadata list length: ${metadata.length}`);
        logger.debug(`metadata list: ${metadata}`);
        const flattenedFolderMetadataList = folderMetadata.flat(1);
        return [...flattenedMetadataList, ...flattenedFolderMetadataList];
    } catch (error) {
        logger.error(error);
        return error;
    }
};

const createTypesFromOrgCmps = (conn, backupDirPath) => new Promise(async (resolve, reject) => {
    try {
        const types = [];
        const typesSet = new Set();
        const fileNamesToIgnore = await getMetadataFilesToIgnore(backupDirPath);
        listAllMetadata(conn, backupDirPath)
            .then((componentsList) => {
                let cmps;
                logger.info('Total Number of Components/Metadata: ', componentsList.length);
                componentsList.forEach((component) => {
                    if (component) {
                        let cmpType = component.type;
                        logger.debug('component.type: ', component.type);
                        // typeof component.type === 'string' to avoid types like:
                        // { '$': [Object]}
                        if (component.type && typeof component.type === 'string'
                        && component.type.includes('Folder')) {
                            cmpType = component.type.replace('Folder', '');
                        }
                        if (component.type === 'EmailFolder') {
                            cmpType = 'EmailTemplate';
                        }
                        if (!typesSet.has(cmpType) && typeof component.type === 'string') {
                            typesSet.add(cmpType);
                            cmps = [];
                            types.push({ name: cmpType, members: cmps });
                            if (!fileNamesToIgnore.includes(component.fullName)) {
                                cmps.push({ '#text': component.fullName });
                            }
                        } else if (!fileNamesToIgnore.includes(component.fullName) && typeof component.type === 'string') {
                            types.find(element => element.name === cmpType).members.push({ '#text': component.fullName });
                        }
                    }
                });
                logger.debug('Types: ', util.inspect(types, { maxArrayLength: null }));
                resolve(types);
            })
            .catch((error) => {
                reject(error);
            });
    } catch (error) {
        reject(error);
    }
});

// Creates types list based on the contents of a
// metadata folder and metadata types list
const createTypesFromFolderCmps = (metadataInfoList, extensionToCmpName) => new
Promise((resolve, reject) => {
    try {
        const types = [];
        extensionToCmpName.forEach((values, key) => {
            logger.debug('key: ', key, 'value: ', values);
            const matchedMetadataInfo = metadataInfoList.find(element => (element.suffix === key
                || (!element.suffix && element.directoryName === key) || element.xmlName === key));
            if (matchedMetadataInfo) {
                logger.debug('matchedMetadataInfo: ', matchedMetadataInfo);
                const typeName = matchedMetadataInfo.xmlName;
                const cmps = [];
                let valuesForProcessing = [];
                // Take care of cmps with folder like email templates, documents etc.
                if (matchedMetadataInfo.inFolder === true) {
                    const dirName = (key === 'email') ? key : `${key}s`;
                    const dirCmpArray = values.map(element => ({
                        elementName: element.elementName,
                        directoryName: dirName,
                    }));
                    logger.debug('dirCmpArray: ', dirCmpArray);
                    const dirElement = [({
                        elementName: values[0].directoryName,
                        directoryName: dirName,
                    })];
                    logger.debug('dirElement: ', dirElement);
                    valuesForProcessing = [
                        ...dirCmpArray,
                        // ...dirElement,
                    ];
                    logger.debug('valuesForProcessing: ', valuesForProcessing);
                } else {
                    valuesForProcessing = [...values];
                }
                logger.debug('valuesForProcessing: ', valuesForProcessing);
                valuesForProcessing.forEach((cmp) => {
                    // if (key === 'site') { // Takes care of Site and SiteDotCom metadata as there suffix is same
                    //   logger.debug('cmp in case of site or sitedotcom: ', cmp);
                    //   typeName = path.dirname(cmp);
                    //   logger.debug('typeName in case of site or sitedotcom: ', typeName);
                    //   const siteCmp = path.basename(cmp);
                    //   logger.debug('siteCmp name in case of site or sitedotcom: ', siteCmp);
                    //   cmps.push({ '#text': siteCmp });
                    // } else {
                    // The second condition after the or will take care of components like aura. lwc and experience bundles that
                    // do not have suffix and metafile as well
                    if (matchedMetadataInfo.directoryName === cmp.directoryName || (!matchedMetadataInfo.suffix
                        && matchedMetadataInfo.metaFile === false)) {
                        if (!cmps.some(e => e['#text'] === cmp.elementName)) { // Check if the element already exists
                            cmps.push({ '#text': cmp.elementName });
                        }
                    }
                });
                if (cmps.length > 0) {
                    types.push({ name: typeName, members: cmps });
                }
            }
        });
        resolve(types);
    } catch (exception) {
        reject(exception);
    }
});

const createPackageManifest = (projectPath, fullOrg, conn) => new Promise((resolve, reject) => {
    let extensionToCmpName;
    if (projectPath) {
        createExtensionToCmpNameMap(projectPath)
            .then((extToCmp) => {
                extensionToCmpName = extToCmp;
                logger.debug('extensionToCmpName: ', extensionToCmpName);
                return getMetaDataInfoList();
            })
            .then((metadataInfoList) => {
                if (fullOrg === true) {
                    return createTypesFromOrgCmps(conn, projectPath);
                }
                return createTypesFromFolderCmps(metadataInfoList, extensionToCmpName);
            })
            .then((types) => {
                if (types.length === 0) {
                    logger.debug('No valid diff files found. Please try some other commit hashes or a full deployment');
                    process.exit(0);
                }
                const manifestVersion = process.env.MANIFEST_VERSION || metadataMappings.latestAPIVersion;
                const packageXMLFeed = builder.create({
                    Package: {
                        '@xmlns': 'http://soap.sforce.com/2006/04/metadata',
                        types,
                        version: manifestVersion,
                    },
                }, { encoding: 'utf-8' });
                const packageXML = packageXMLFeed.end({ pretty: true });
                logger.debug(`Manifest File: ${packageXML}`);
                logger.debug(`projectPath: ${projectPath}`);
                if (fsExtra.existsSync(`${projectPath}/src`)) {
                    fsExtra.writeFileSync(`${projectPath}/src/package.xml`, packageXML);
                } else {
                    fsExtra.writeFileSync(`${projectPath}/package.xml`, packageXML);
                }
                resolve('Package.xml created successfully.....');
            })
            .catch((error) => {
                reject(error);
            });
    }
});


// Export methods
module.exports = {
    createPackageManifest,
    getMetaDataInfoList,
    listAllMetadata,
    fetchMetadataMappings,
    getMetadataTypesWithMetaFile,
};

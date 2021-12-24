#!/usr/bin/env node

const shellJS = require('shelljs');
const fs = require('fs');
const logger = require('../utils/logger');

const getTestsFromTargetOrg = (apexClassesList) => new Promise((resolve, reject) => {
    const codeCoverageQuery = `SELECT ApexTestClass.Name
                               FROM ApexCodeCoverage
                               WHERE ApexClassorTrigger.Name IN (${apexClassesList.map(name => `'${name}'`).join(', ')})`;
    const target = 'AVG_SFQA';
    const queryRes = shellJS.exec(`sfdx force:data:soql:query -t -q "${codeCoverageQuery}" -u ${target} -r json`, {silent: true});

    const apexClassNameWithId = JSON.parse(queryRes.stdout);
    resolve(new Set(apexClassNameWithId.result.records.map(payload => payload.ApexTestClass.Name)));
});

const getApexClassesFromArticlePath = (articlePath, projectType) => new Promise((resolve, reject) => {
    let apexClassesQuery;
    if (projectType === 'mdapi') {
        apexClassesQuery = `${articlePath}/classes/`;
    } else if (projectType === 'source') {
        // TODO: need to account for non-default package
        apexClassesQuery = `${articlePath}/force-app/main/default/classes/`;
    } else {
        logger.error(`Provided projectType: ${projectType} is not recognized`);
        reject();
    }
    //clean extra /'s
    apexClassesQuery.replaceAll('//', '/');

    const listOfClasses = fs.readdirSync(apexClassesQuery);

    const categorizedClasses = {
        Classes: [],
        Tests: []
    };

    listOfClasses.forEach(filePath => {
        if (filePath.endsWith('.cls')) {
            const className = filePath.split('/').at(-1);
            //TODO: this is first method to determine test classes. if this fails, move to grep contents
            if (className.toLowerCase().includes('test')) {
                categorizedClasses.Tests.push(className.replace('.cls', ''));
            } else {
                categorizedClasses.Classes.push(className.replace('.cls', ''));
            }
        }
    });
});

const autoResolveRelevantTests = (articlePath, projectType) => new Promise((resolve, reject) => {
    getApexClassesFromArticlePath(articlePath, projectType)
        .then((result) => {
            return getTestsFromTargetOrg(result.Classes);
        })
        .catch((error) => {
            logger.error(`intelligentTests.js :: ${error}`);
        })
});

module.exports = {
    autoResolveRelevantTests
}


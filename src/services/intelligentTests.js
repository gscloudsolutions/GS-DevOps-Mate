#!/usr/bin/env node

const shellJS = require('shelljs');
const fs = require('fs');
const logger = require('../utils/logger');

const getTestsFromTargetOrg = (apexClassesList, targetUsername) => {
    const codeCoverageQuery = `SELECT ApexTestClass.Name,
                                      ApexClassorTrigger.Name
                               FROM ApexCodeCoverage
                               WHERE ApexClassorTrigger.Name IN (${apexClassesList.map(name => `'${name}'`).join(', ')})`;

    //TODO: we have enough info here to build an apex class -> apex test dependency map, would be neat in the future
    const queryRes = shellJS.exec(`sfdx force:data:soql:query -t -q "${codeCoverageQuery}" -u ${targetUsername} -r json`, {silent: true});

    const apexClassNameWithId = JSON.parse(queryRes.stdout);
    return [...new Set(apexClassNameWithId.result.records.map(payload => payload.ApexTestClass.Name))];
};

const getApexClassesFromArticlePath = (articlePath) => {
    const apexClassesQuery = `${articlePath}/classes/`;
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
            //TODO: this is first attempt to determine test classes. if this fails, move to grep contents
            if (className.toLowerCase().includes('test')) {
                categorizedClasses.Tests.push(className.replace('.cls', ''));
            } else {
                categorizedClasses.Classes.push(className.replace('.cls', ''));
            }
        }
    });

    return categorizedClasses;
};

const autoResolveRelevantTests = (articlePath, targetUsername) => {
    const apexClasses = getApexClassesFromArticlePath(articlePath);
    return getTestsFromTargetOrg(apexClasses.Classes, targetUsername);
};

module.exports = {
    autoResolveRelevantTests
}


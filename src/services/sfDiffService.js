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
const dirCompare = require("dir-compare");
const emoji = require("node-emoji");
const util = require("util");
const TableBuilder = require("table-builder");

const argv = require("minimist")(process.argv.slice(2), {
    string: ["compareOrgs", "compareOrgWithRepo", "compareRepos"],
});

console.log(emoji.emojify(":rocket:  Comparison Started................................... :rocket:"));
const environment = process.env.NODE_ENV || "local";
const config = require(`../config/${environment}-config.json`);
// const retrieve = require('./retrieve');

const dehydrate = (element, name, path) => ({
    type: element.relativePath.replace("/", ""),
    name: element[name],
    fullPath: `${element[path]}/${element[name]}`,
});

const createTypeToNamesMap = (elements) => {
    let names;
    const typeSet = new Set();
    const typesToNameObj = {};
    elements.forEach((element) => {
        console.log(element);
        if (!typeSet.has(element.type)) {
            typeSet.add(element.type);
            names = [];
            names.push(element.name);
            typesToNameObj[element.type] = names;
        } else {
            typesToNameObj[element.type].push(element.name);
        }
    });
    return typesToNameObj;
};

dirCompare.compare(config.projectpath, config.diffProjectPath);

// TODO: Implenent the org comparison feature
const compareTwoOrgs = (orgOne, orgTwo) => new Promise((resolve, reject) => {});

// TODO: Implenent the org to repo comparison feature
const compareOrgWithRepo = (orgToCompare, folderLocationToCompare) => new Promise((resolve, reject) => {});

const compareTwoRepos = (folderLocationOne, folderLocationTwo) =>
    new Promise((resolve, reject) => {
        const options = {
            compareContent: true,
            ignoreLineEnding: true,
            ignoreWhiteSpaces: true,
        };

        const sourcePath = folderLocationOne;
        const targetPath = folderLocationTwo;

        dirCompare.compare(sourcePath, targetPath, options).then((res) => {
            const { diffSet } = res;
            // console.log(util.inspect(res, { maxArrayLength: null }));
            console.log("Number of DiffSet Entries: ", diffSet.length);
            // Items only in sourcePath would be treated as new items
            const onlyPathOneFiles = diffSet
                .filter((element) => {
                    if (element.state === "left" && element.type1 === "file" && element.type2 === "missing") {
                        return element;
                    }
                })
                .map((element) => dehydrate(element, "name1", "path1"));
            console.log("Number of onlyPathOneFiles:", onlyPathOneFiles.length);
            console.log(util.inspect(onlyPathOneFiles, { maxArrayLength: null }));

            // const newItems = createTypeToNamesMap(onlyPathOneFiles);
            const headers = { name: "Name", type: "Type" };
            const table = new TableBuilder();
            console.log(`<html>
      ${table.setHeaders(headers).setData(onlyPathOneFiles).render()}
      </html>`);
            // Items only in target would be treated as items that can considered for deletion
            // const onlyPathTwoFiles = diffSet.filter((element) => {
            //   if (element.state === 'right'
            //   && element.type2 === 'file' && element.type1 === 'missing') {
            //     return element;
            //   }
            // }).map(element => dehydrate(element, 'name2', 'path2'));

            // console.log('Number of onlyPathTwoFiles:', onlyPathTwoFiles.length);
            // console.log(util.inspect(onlyPathTwoFiles, { maxArrayLength: null }));
            // // Same items (Not changed items)
            // const unchangedItems = diffSet.filter((element) => {
            //   if (element.type1 === 'file' && element.state === 'equal') {
            //     return element;
            //   }
            // }).map(element => dehydrate(element, 'name1', 'path1'));
            // console.log('unchangedItems.length: ', unchangedItems.length);
            // console.log(util.inspect(unchangedItems, { maxArrayLength: null }));
            // // Changed Items
            // const distinctItems = diffSet.filter((element) => {
            //   if (element.type1 === 'file' && element.state === 'distinct') {
            //     return element;
            //   }
            // }).map(element => dehydrate(element, 'name1', 'path1'));
            // console.log('distinctItems.length: ', distinctItems.length);
            // console.log(util.inspect(distinctItems, { maxArrayLength: null }));
        });
    });

if (argv.compareOrgs === "true") {
    compareTwoOrgs();
}
if (argv.compareOrgWithRepo === "true") {
    compareOrgWithRepo();
}
if (argv.compareRepos === "true") {
    compareTwoRepos(config.pathOneToCompare, config.pathTwoToCompare);
}

// Export all methods
module.exports = { compareTwoOrgs, compareOrgWithRepo, compareTwoRepos };

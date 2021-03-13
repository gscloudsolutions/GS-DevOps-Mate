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
const shellJS = require('shelljs');
const program = require('commander');

const authenticate = require('../services/authenticationService.js');
const deploymentInfoService = require('../services/deploymentInfoService');
const logger = require('../utils/logger');

// Various Command Definitions and Actions for Deployment Info Custom Settings
program
    .description('Set of commands to CRU for Deployment Info Custom Settings');

program
    .command('get')
    .description('Get the Commit SHA/Commit Tag for latest deployment in a target org')
    .option('-n --module <name>', 'modulename to get its latest state in the target')
    .option('-u --targetUserName <uname>', 'username/alias/access token for the target org.')
    .option('-i --buildId <id>', 'buildId/buildnumber to distinguish the deployment info in the target org.')
    .option('-s --password <secret>', 'password for the target org add secret token as well if the target system is not open for the ip ranges.')
    .option('-t --envType <type>', 'either SANDBOX, PRODUCTION, DEVELOPER or SCRATCH')
    .action((command) => {
        // TODO: Add Required fields validation
        // if (command.password) {
        const { module, buildId } = command;
        logger.debug('module: ', module);
        logger.debug('buildId: ', buildId);
        if (!command.envType) {
            logger.error('-t --envType is required with username-password based deployment');
            process.exit(1);
        }
        authenticate.loginWithCreds(command.targetUserName, command.password, command.envType)
            .then(connection => deploymentInfoService.getDeploymentInfo(module, connection, buildId))
            .then((message) => {
                logger.debug(message);
                process.exit(0);
            })
            .catch((err) => {
                logger.debug(err);
                process.exit(1);
            });
        /* }else {
            deploymentInfoService.getDeploymentInfo(command.module, command.targetUserName, command.buildId)
                .then((message) => {
                    logger.debug(message);
                    process.exit(0);
                })
                .catch((err) => {
                    logger.debug(err);
                    process.exit(1);
                });
        } */ // TODO:  Access Token based implementation
    });

program
    .command('updateByName')
    .description('Updates the commit revision value based on the module name passed for a deployment info custom settings record')
    .option('-n --module <name>', 'module name of the deployment info custom settings record to be updated')
    .option('-u --targetUserName <uname>', 'username/alias/access token for the target org.')
    .option('-s --password <secret>', 'password for the target org add secret token as well if the target system is not open for the ip ranges.')
    .option('-r --revision <sha>', 'short SHA based commit revision.')
    .option('-t --envType <type>', 'either SANDBOX, PRODUCTION, DEVELOPER or SCRATCH')
    .action((command) => {
        const {
            module, targetUserName, password, envType, revision,
        } = command;
        if (password) {
            logger.debug('module: ', module);
            if (!command.envType) {
                logger.error('-t --envType is required with username-password based deployment');
                process.exit(1);
            }
            authenticate.loginWithCreds(targetUserName, password, envType)
                .then((connection) => {
                    // set the url configuration, required in case of running sfdx commands with access token
                    shellJS.exec(`sfdx force:config:set instanceUrl=${connection.instanceURL} --global`);
                    return deploymentInfoService.updateDeploymentInfoByName(module, revision, connection.accessToken);
                })
                .then((message) => {
                    logger.debug(message);
                    process.exit(0);
                })
                .catch((err) => {
                    logger.debug(err);
                    process.exit(1);
                });
        } else {
            deploymentInfoService.updateDeploymentInfoByName(module, revision, targetUserName)
                .then((message) => {
                    logger.debug(message);
                    process.exit(0);
                })
                .catch((err) => {
                    logger.error(err);
                    process.exit(1);
                });
        }
    });

program.parse(process.argv);
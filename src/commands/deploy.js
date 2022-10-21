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
const fs = require('fs-extra');
const program = require('commander');
const path = require('path');

const authenticate = require('../services/authenticationService');
const deploymentService = require('../services/deploymentService')
const deploymentInfoService = require('../services/deploymentInfoService');
const gitUtils = require('../utils/gitUtils');
const notify = require('../utils/notificationsUtil');
const logger = require('../utils/logger');

const projectPath = process.env.PROJECT_PATH || '.';

const ARTIFACTS_DIR_NAME = 'Artifacts';
const MDAPI_PACKAGE_NAME = process.env.MDAPI_PACKAGE_NAME ? process.env.MDAPI_PACKAGE_NAME : 'mdapiPackage';

const {
    SF_USERNAME, SF_ENV_TYPE,
    SF_PASSWORD, GIT_SUCCESS_TAG,
    SLACK_NOTIFICATION_URI, MIN_OVERALL_CODE_COVERAGE,
} = process.env;

// Setup Constants
const  constants = {

    username    : null,
    password    : null,
    envType     : null,
    uri         : null,
    alias       : null,
    minCodeCoverage : null,
    gitAnnotatedTag : null,

    set : function(command){
        this.username    = command.username  ? command.username  : SF_USERNAME;
        this.password    = command.password  ? command.password  : SF_PASSWORD;
        this.envType     = command.envType   ? command.envType   : SF_ENV_TYPE;
        this.uri         = command.uri       ? command.uri       : SLACK_NOTIFICATION_URI;
        this.alias       = command.targetUserName;
        this.minCodeCoverage = command.envType   || MIN_OVERALL_CODE_COVERAGE    || 75;
        this.gitAnnotatedTag = command.gitTag    ? command.gitTag    : GIT_SUCCESS_TAG;
    }
};

program
    .description('Set of commands to deploy/validate on Salesforce');

program
    .command('mdapipackage')
    .description('Deploys or validates an MDAPI artifact to the target Org.')
    .option('-p --artifactpath <artifactpath>', 'The location of the artifact to be deployed.')
    .option('-v --artifactversion <version>', 'Custom version identifier of the artifact.')
    .option('-u --username <username>', 'The username of the target Org.')
    .option('-t --envType <type>', 'The environment type of target Org. Either SANDBOX, PRODUCTION, DEVELOPER or SCRATCH.')
    .option('-s --password <secret>', 'The password for the target org appended with the security token.')
    .option('-a --targetUserName <tuname>', 'The username/alias for the target Org that is already authenticated via JWT.')
    .option('-c --validate <validate>', 'Specifies either artifact validation or deployment. If validate, no changes will be deployed to target Org.')
    .option('-g --gitTag <tag>', 'The tag name (annotated not lightweight) to be applied after a successful deployment.')
    .option('-l --testlevel <testLevel>', '(NoTestRun|RunSpecifiedTests|RunLocalTests|RunAllTestsInOrg) deployment testing level.')
    .option('-r --successSHA <sha>', 'The latest commit SHA to be stored in target Org Custom Setting.')
    .option('-m --minCodeCoverage <minCodeCoverage>', 'Minimum overall code coverage for the build')
    .option('-i --buildId <id>', 'Build-Id/Build-Number for uniquely identifying the deployment information.')
    .option('-n --uri <uri>', 'Slack notification Webhook URI.')
    .option('-k --testsLists <tests>', 'tests lists')
    .option('--notificationTitle <title>', 'Custom Notification Title for Slack')
    .option('-b --bypass <title>', 'Bypass Deployment Info Update with the latest commit SHA')
    .option('-o --module <name>', 'modulename to set the commit SHA after the deployment process. Default: All', 'All')
    .action((command) => {
        logger.debug(process.env);
        logger.info('command.artifactpath', command.artifactpath);
        logger.info('command.artifactversion', command.artifactversion);
        logger.info('command.targetUserName', command.targetUserName);
        logger.info('command.buildId', command.buildId);
        logger.debug('command.uri', command.uri);
        logger.debug('command.notificationTitle', command.notificationTitle);
        logger.debug('command.bypass', command.bypass);
        logger.debug('command.successSHA', command.successSHA);
        logger.debug('command.validate', command.validate);

        // Setup constants
        logger.debug('Setting up Variables');
        constants.set(command);

        // Process Artifact
        logger.debug('Processing Artifact');
        let artifact = deploymentService.artifactProcessor.checkPath(command)
                                           .setVersion(command, projectPath)
                                           .setName(MDAPI_PACKAGE_NAME)
                                           .exists(command, ARTIFACTS_DIR_NAME, constants.uri);


        // Authenticate User and Run Deployment
        logger.debug('Authenticating Salesforce User');
        authenticate.authenticateUser(command, constants)
        .then(con => {
            if(con.type === 'connection'){
                shellJS.exec(`sfdx force:config:set instanceUrl=${con.token.instanceURL} --global`);
            }
            /* Begins the deployment */
            logger.debug('Beginning MDAPI Deployment Process');
            return deploymentService.deploymentProcessor.mdapiDeploy(command, constants, artifact, con.token, con.type, ARTIFACTS_DIR_NAME, projectPath);
        })
        .then(result => {
            logger.info(result);
            process.exit(0);
        })
        .catch(error => {
            logger.error(error);
            process.exit(1);
        });
    });


program
    .command('quick-deploy')
    .description('Quick Deploy last validated package.')
    .option('-p --artifactpath <artifactpath>', 'The location of the artifact to be deployed.')
    .option('-v --artifactversion <version>', 'Custom version identifier of the artifact.')
    .option('-u --username <username>', 'The username of the target Org.')
    .option('-t --envType <type>', 'The environment type of target Org. Either SANDBOX, PRODUCTION, DEVELOPER or SCRATCH.')
    .option('-s --password <secret>', 'The password for the target org appended with the security token.')
    .option('-a --targetUserName <tuname>', 'The username/alias for the target Org that is already authenticated via JWT.')
    .option('-i --buildId <id>', 'Build-Id/Build-Number for uniquely identifying the deployment information.')
    .option('-r --successSHA <sha>', 'The latest commit SHA to be stored in target Org Custom Setting.')
    .option('-n --uri <uri>', 'Slack notification Webhook URI.')
    .option('--notificationTitle <title>', 'Custom Notification Title for Slack')
    .option('-b --bypass <title>', 'Bypass Deployment Info Update with the latest commit SHA')
    .option('-l --testlevel <testLevel>', '(NoTestRun|RunSpecifiedTests|RunLocalTests|RunAllTestsInOrg) deployment testing level.')
    .option('-k --testsLists <tests>', 'tests lists')
    .option('-o --module <name>', 'modulename to set the commit SHA after the deployment process. Default: All', 'All')
    .action((command) => {
        logger.debug(process.env);
        logger.info('command.artifactpath', command.artifactpath);
        logger.info('command.artifactversion', command.artifactversion);
        logger.info('command.targetusername', command.targetusername);
        logger.debug('command.uri', command.uri);
        logger.debug('command.notificationTitle', command.notificationTitle);
        logger.debug('command.bypass', command.bypass);
        logger.info('command.buildId', command.buildId);
        logger.debug('command.successSHA', command.successSHA);

        // Setup constants
        constants.set(command);

        // Process Artifact
        logger.debug('Processing Artifact');
        let artifact = deploymentService.artifactProcessor.checkPath(command)
                                           .setVersion(command, projectPath)
                                           .setName(MDAPI_PACKAGE_NAME)
                                           //.exists(command, ARTIFACTS_DIR_NAME); No need to check for artifact's existence as it relies on validated deployment Id from the org

        // Authenticate User and Run Deployment
        authenticate.authenticateUser(command, constants)
        .then(con=>{
            if(con.type === 'connection'){
                shellJS.exec(`sfdx force:config:set instanceUrl=${con.token.instanceURL} --global`);
            }
            deploymentService.deploymentProcessor.quickDeploy(command, constants, artifact, con.token, con.type, ARTIFACTS_DIR_NAME, projectPath);
        })
        .catch(error => {
            logger.error(error);
            process.exit(1);
        });
    });



program.parse(process.argv);
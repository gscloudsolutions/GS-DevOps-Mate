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

const program = require('commander');

const secondGenPckgInstallation = require('../services/secondGenPckgInstallationService');
const logger = require('../utils/logger');

// Various Command Definitions and Actions for Package Installation
program
    .description('Set of commands to install packages');

program
    .command('second-gen-pckg')
    .description('Installs a second generation package')
    .option('-p, --package <package>', 'ID (starts with 04t) or alias of the package version to install (optional)')
    .option('-u, --targetusername <username>', 'username or alias for the target org; overrides default target org')
    .option('-s, --password <password>', 'password for the target org (optional)')
    .option('-e, --envtype <envtype>', 'environment type for the target org (required if password is used, SANDBOX|SCRATCH|DEVELOPER|PRODUCTION)')
    .option('-k, --installationkey <key>', 'installation key for the package (only required if the package needs a key)')
    .action((command) => {
        secondGenPckgInstallation.installPackage(command)
            .then((result) => {
                logger.info(result);
                process.exit(0);
            })
            .catch((error) => {
                logger.error(error);
                process.exit(1);
            });
    });

program
    .command('second-gen-uninstall')
    .description('Uninstalls a second generation package')
    .option('-p, --package <package>', 'ID (starts with 04t) or alias of the package version to uninstall (optional)')
    .option('-u, --targetusername <username>', 'username or alias for the target org; overrides default target org')
    .option('-s, --password <package>', 'password for the target org (optional)')
    .option('-e, --envtype <envtype>', 'environment type for the target org (required if password is used, SANDBOX|SCRATCH|DEVELOPER|PRODUCTION)')
    .action((command) => {
        secondGenPckgInstallation.uninstallPackage(command)
            .then((result) => {
                logger.info(result);
                process.exit(0);
            })
            .catch((error) => {
                logger.error(error);
                process.exit(1);
            });
    });

program.parse(process.argv);

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

const logger = require('./logger');

const getSHARevision = (projectPath, shaTag) => {
    const currentDirectory = shellJS.exec('pwd').stdout;
    shellJS.cd(projectPath); // Get into the project
    const shortSHA = shellJS.exec(`git rev-parse --short ${shaTag}`).stdout.trim();
    logger.debug('shortSHA: ', shortSHA);
    if (shortSHA === '') {
        logger.error('Something went wrong while finding the commit SHA revision');
        process.exit(1);
    }
    shellJS.cd(currentDirectory); // Get back into current directory
    logger.debug('typeof shortSHA: ', typeof shortSHA);
    logger.debug('shortSHA: ', shortSHA);
    return shortSHA;
};

// Export methods
module.exports = {
    getSHARevision,
};

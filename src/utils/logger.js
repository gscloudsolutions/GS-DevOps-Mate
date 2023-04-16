/* Copyright (c) 2019-2023 Groundswell Cloud Solutions Inc. - All Rights Reserved
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF
 * ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
 * USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

const log4js = require("log4js");

const LOGGING_LEVEL = process.env.LOGGING_LEVEL || "info"; // can be one of the ALL < TRACE < DEBUG < INFO < WARN < ERROR < FATAL < MARK and
// OFF (Off switches off the logging at all)

log4js.configure({
    appenders: {
        out: {
            type: "stdout",
            layout: {
                type: "pattern",
                pattern: "[%[%d|%p|Line:%l in %f{2}%]] %m %n",
            },
        },
    },
    categories: { default: { appenders: ["out"], level: LOGGING_LEVEL, enableCallStack: true } },
});
const logger = log4js.getLogger();
logger.addContext("customText", "at ");
logger.level = LOGGING_LEVEL; // default level is info - which means all the logs below debug would be there.

module.exports = logger;

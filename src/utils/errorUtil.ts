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

// TODO: Check if some of it might not be required now
/**
 * @param text - sfdx stderr output
 * @return {boolean} - Whether or not the given input contains a valid JSON
 */
const isJSON = (text) => {
    if (typeof text !== "string") {
        return false;
    }
    try {
        JSON.parse(text, true);
        return true;
    } catch (error) {
        return false;
    }
};

/**
 *
 * @param stderr - sfdx stderr output
 * @return Promise - JSON parsed stderr, or the original error string itself if unable to be parsed
 */
const handleStderr = (stderr) =>
    new Promise((resolve, reject) => {
        if (stderr && isJSON(stderr)) {
            const errorJSON = JSON.parse(stderr, true);
            resolve(errorJSON);
        }
        reject(JSON.stringify(stderr));
    });

module.exports = {
    handleStderr,
};

const logger = require("./logger");

const init = () => {
    process.on("uncaughtException", (err) => {
        logger.error(err);
        process.exit(1);
        // Add a notification handler for monitoring
    });
};

// Export methods
module.exports = {
    init,
};

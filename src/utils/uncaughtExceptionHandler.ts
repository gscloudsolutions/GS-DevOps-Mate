import logger from "./logger";

export function init() {
    process.on("uncaughtException", (err) => {
        logger.error(err);
        process.exit(1);
    });
}

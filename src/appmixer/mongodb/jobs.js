'use strict';
const { cleanupConnections } = require('./common');

let isConnectionSyncInProgress = false;

module.exports = async (context) => {
    await context.scheduleJob('cleanupConnectionsJob', '0 */1 * * * *', async () => {
        if (isConnectionSyncInProgress) {
            await context.log('info', '[MongoDB] Connection cleanup already in progress. Skipping...');
            return;
        }
        isConnectionSyncInProgress = true;

        try {
            await cleanupConnections(context);
        } catch (error) {
            await context.log('error', `[MongoDB] Error cleaning connections: ${error.message}`);
        } finally {
            isConnectionSyncInProgress = false;
        }
    });
};

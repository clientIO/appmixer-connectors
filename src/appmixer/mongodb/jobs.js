'use strict';
<<<<<<< Updated upstream
const { cleanupConnections } = require('./common');
=======

const connections = require('./connections');
>>>>>>> Stashed changes

let isConnectionSyncInProgress = false;

module.exports = async (context) => {
<<<<<<< Updated upstream
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
=======
    const config = require('./config')(context);

    // Synchronize MongoDB connections across cluster nodes
    await context.scheduleJob('syncMongoConnectionsJob', config.syncConnectionsJob.schedule, async () => {
        if (isConnectionSyncInProgress) {
            await context.log('info', '[MongoDB] Connection sync job already in progress. Skipping...');
            return;
        }

        isConnectionSyncInProgress = true;

        try {
            // Load all registered MongoDB connections from cluster state
            const registeredConnections = await context.service.loadState();
            const openConnections = connections.listConnections();

            await context.log('info', [
                '[MongoDB] Syncing MongoDB connections.',
                '# of open Connections: ' + Object.keys(openConnections).length,
                '# of registered Connections: ' + registeredConnections.length
            ].join('; '));

            for (const conn of registeredConnections) {
                const connectionId = conn.key;
                const connectionParameters = conn.value;

                // Ensure the flow using the connection is still running
                const flow = await context.db.coreCollection('flows')
                    .findOne({ flowId: connectionParameters.flowId, stage: 'running' });

                if (!flow) {
                    await context.log('info', `[MongoDB] Flow ${connectionParameters.flowId} is not running. Removing connection ${connectionId}.`);
                    await connections.closeConnection(connectionId);
                    continue;
                }

                if (!openConnections[connectionId]) {
                    const stillNeeded = await context.service.stateGet(connectionId);
                    if (stillNeeded) {
                        await context.log('info', `[MongoDB] Recreating missing connection ${connectionId}.`);
                        await connections.getOrCreateConnection(connectionParameters.connectionUri, connectionParameters.options); // eslint-disable-line max-len
                    }
                }
            }

            // Close stale connections that are no longer registered
            for (const connectionId of Object.keys(openConnections)) {
                const conn = await context.service.stateGet(connectionId);
                if (!conn) {
                    await context.log('info', `[MongoDB] Closing stale connection ${connectionId}.`);
                    await connections.closeConnection(connectionId);
                }
            }

        } catch (error) {
            await context.log('error', `[MongoDB] Error during connection sync: ${error.message}.`);
>>>>>>> Stashed changes
        } finally {
            isConnectionSyncInProgress = false;
        }
    });
};

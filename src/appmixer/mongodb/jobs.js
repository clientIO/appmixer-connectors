'use strict';

const common = require('./common');

let isConnectionSyncInProgress = false;

module.exports = async (context) => {
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
            const registeredConnections = await context.service.loadState();  // [{key, value}]
            const openConnections = common.listConnections();

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
                    await common.closeClient(context, connectionId);
                    continue;
                }

                // Recreate connections if they exist in cluster state but not locally
                if (!openConnections[connectionId]) {
                    const stillNeeded = await context.service.stateGet(connectionId);
                    if (stillNeeded) {
                        await context.log('info', `[MongoDB] Recreating missing connection ${connectionId}.`);
                        await common.getClient(context, connectionParameters.flowId, connectionParameters.componentId, connectionParameters.auth); // eslint-disable-line max-len
                    }
                }
            }

            // Close stale connections that are no longer registered
            for (const connectionId of Object.keys(openConnections)) {
                const conn = await context.service.stateGet(connectionId);
                if (!conn) {
                    await context.log('info', `[MongoDB] Closing stale connection ${connectionId}.`);
                    await common.closeClient(context, connectionId);
                }
            }

        } catch (error) {
            await context.log('error', `[MongoDB] Error during connection sync: ${error.message}.`);
        } finally {
            isConnectionSyncInProgress = false;
        }
    });
};

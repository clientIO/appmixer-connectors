'use strict';

const connections = require('./connections');

let isConnectionSyncInProgress = false;

module.exports = async (context) => {

    const config = require('./config')(context);

    // This job synchronizes the connections between the cluster nodes.
    await context.scheduleJob('syncConnectionsJob', config.syncConnectionsJob.schedule, async () => {

        if (isConnectionSyncInProgress) {
            await context.log('info', '[KAFKA] connections sync job is already in progress. Skipping...');
            return;
        }

        isConnectionSyncInProgress = true;

        try {
            // All registered connections, throughout the cluster.
            const registeredConnections = await context.service.loadState(); // [{key, value}]
            // Live connections that are registered in this specific node of the cluster.
            const openConnections = connections.listConnections();

            await context.log('info', [
                '[KAFKA] Syncing Kafka connections. ',
                '# of open Connections: ' + Object.keys(openConnections).length,
                '# of registered Connections: ' + registeredConnections.length
            ].join('; ');

            for (const conn of registeredConnections) {
                const connectionId = conn.key;
                const connectionParameters = conn.value;

                // Check that the flow still exists and is running. This is a sanity check to make sure that if an error
                // occures when removing connections from the global state, we are still able to recover in this job run.
                const flow = await context.db.coreCollection('flows').findOne({ flowId: connectionParameters.flowId, stage: 'running' });
                if (!flow) {
                    await context.log('info', `[KAFKA] Flow ${connectionParameters.flowId} does not exist or is not running. Removing connection ${connectionId}.`);
                    await connections.removeConnection(context, connectionId);
                    continue;
                }

                if (!openConnections[connectionId]) {
                    // The connection is not created on this node in the cluster. Create it but before that check
                    // if it's really needed (still registered in the cluster).
                    const stillNeeded = await context.service.stateGet(connectionId);
                    if (stillNeeded) {
                        await context.log('info', `[KAFKA] Connection not locally open but desired in cluster. Creating connection ${connectionId}.`);
                        if (connections.isConsumerConnection(connectionId)) {
                            await connections.addConsumer(
                                context,
                                connectionParameters.topics,
                                connectionParameters.flowId,
                                connectionParameters.componentId,
                                connectionParameters.groupId,
                                connectionParameters.fromBeginning,
                                connectionParameters.auth
                            );
                        } else {
                            await connections.addProducer(
                                context,
                                connectionParameters.flowId,
                                connectionParameters.componentId,
                                connectionParameters.auth
                            );
                        }
                    }
                }
            }

            // If the connection is live on this node but it is not desired anymore (not registered in the cluster), remove it.
            for (const connectionId of Object.keys(openConnections)) {
                const conn = await context.service.stateGet(connectionId);
                if (!conn) {
                    await context.log('info', `[KAFKA] Connection locally open but not desired in the cluster. Removing connection ${connectionId}.`);
                    await connections.removeConnection(context, connectionId);
                }
            }

        } catch (error) {
            await context.log('error', `[KAFKA] Error occurred during connection sync job: ${error.message}`);
        } finally {
            isConnectionSyncInProgress = false;
        }
    });
};


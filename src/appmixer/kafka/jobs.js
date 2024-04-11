'use strict';
const connections = require('./connections');
const pLimit = require('p-limit');

// Flag to indicate whether the connection sync job is in progress
let isConnectionSyncInProgress = false;

module.exports = async (context) => {

    const config = require('./config')(context);
    const limit = pLimit(parseInt(context.config.syncConnectionsJobConcurrency, 10) || 30); // Limit concurrency to 30

    await context.scheduleJob('syncConnectionsJob', config.syncConnectionsJob.schedule, async () => {


        // Check if a connection sync job is already in progress
        if (isConnectionSyncInProgress) {
            await context.log('info', 'Connection sync job is already in progress. Skipping...');
            return;
        }

        // Set the flag to indicate that the connection sync job is in progress
        isConnectionSyncInProgress = true;

        try {
            const registeredComponents = await context.service.loadState();
            const registeredComponentsKeys = new Set(registeredComponents.map(item => item.key));
            const existingConnections = connections.listConnections();
            // Connect a single component with concurrency limit
            const connectComponent = async (component) => {
                const connectionId = `${component.flowId}:${component.componentId}`;
                if (!existingConnections.includes(connectionId)) {
                    await context.log('info', `Connecting component: ${connectionId}`);
                    await connections.addConnection(context, component.value);
                }
            };

            // Map over the registered components with concurrency limit
            await Promise.all(registeredComponents.map(component => limit(() => connectComponent(component))));

            // Disconnect components that are in the existing connections but not in the service state
            await Promise.all(existingConnections.map(connectionId => limit(async () => {
                if (!registeredComponentsKeys.has(connectionId)) {
                    await context.log('info', `Disconnecting component: ${connectionId}`);
                    await connections.removeConnection({
                        flowId: connectionId.split(':')[0],
                        componentId: connectionId.split(':')[1]
                    });
                }
            })));
        } catch (error) {
            await context.log('error', `Error occurred during connection sync job: ${error.message}`);
        } finally {
            // Reset the flag to indicate that the connection sync job is completed
            isConnectionSyncInProgress = false;
        }
    });
};

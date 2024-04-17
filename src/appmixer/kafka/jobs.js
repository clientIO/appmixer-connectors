'use strict';
const connections = require('./connections');
const pLimit = require('p-limit');

let isConnectionSyncInProgress = false;

module.exports = async (context) => {

    const config = require('./config')(context);
    const limit = pLimit(parseInt(context.config.syncConnectionsJobConcurrency, 10) || 30);

    await context.scheduleJob('syncConnectionsJob', config.syncConnectionsJob.schedule, async () => {

        if (isConnectionSyncInProgress) {
            await context.log('info', 'Connection sync job is already in progress. Skipping...');
            return;
        }

        isConnectionSyncInProgress = true;

        try {
            const registeredComponents = await context.service.loadState();
            const registeredComponentsKeys = new Set(registeredComponents.map(item => item.key));
            const existingConnections = connections.listConnections();

            const connectComponent = async (component) => {

                const connectionId = `${component.value.flowId}:${component.value.componentId}`;
                if (!existingConnections.includes(connectionId)) {
                    const latestState = await context.service.stateGet(connectionId);
                    // Check if the component is still registered
                    if (latestState) {
                        await context.log('info', `Connecting component: ${connectionId}`);
                        await connections.addConnection(context, component.value, component.value.mode);
                    }
                }
            };

            await Promise.allSettled(registeredComponents.map(component => limit(() => connectComponent(component))));

            await Promise.allSettled(existingConnections.map(connectionId => limit(async () => {
                if (!registeredComponentsKeys.has(connectionId)) {
                    const latestState = await context.service.stateGet(connectionId);
                    if (!latestState) {
                        await context.log('info', `Disconnecting component: ${connectionId}`);
                        const [flowId, componentId] = connectionId.split(':');
                        await connections.removeConnection({ flowId, componentId });
                    }
                }
            })));

        } catch (error) {
            await context.log('error', `Error occurred during connection sync job: ${error.message}`);
        } finally {
            isConnectionSyncInProgress = false;
        }
    });
};

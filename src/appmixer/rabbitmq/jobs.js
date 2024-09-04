'use strict';

const connections = require('./connections');

let isConnectionSyncInProgress = false;

module.exports = async (context) => {

    const config = require('./config')(context);

    // This job synchronizes the connections between the cluster nodes.
    await context.scheduleJob('syncConnectionsJob', config.syncConnectionsJob.schedule, async () => {

        if (isConnectionSyncInProgress) {
            await context.log('info', '[RABBITMQ] connections sync job is already in progress. Skipping...');
            return;
        }

        isConnectionSyncInProgress = true;

        try {
            // All registered channels, throughout the cluster.
            const registeredChannels = await context.service.loadState(); // [{key, value}]
            // Live channels that are registered in this specific node of the cluster.
            const openChannels = connections.listChannels();

            await context.log('info', [
                '[RABBITMQ] Syncing RabbitMQ channels. ',
                '# of open Channels: ' + Object.keys(openChannels).length,
                '# of registered Channels: ' + registeredChannels.length
            ].join('; '));

            for (const channel of registeredChannels) {
                const channelId = channel.key;
                const connectionParameters = channel.value;

                // Check that the flow still exists and is running. This is a sanity check to make sure that if an error
                // occures when removing channels from the global state, we are still able to recover in this job run.
                const flow = await context.db.coreCollection('flows').findOne({ flowId: connectionParameters.flowId, stage: 'running' });
                if (!flow) {
                    await context.log('info', `[RABBITMQ] Flow ${connectionParameters.flowId} does not exist or is not running. Removing channel ${channelId}.`);
                    await connections.removeChannel(context, channelId);
                    continue;
                }

                if (!openChannels[channelId]) {
                    // The channel is not created on this node in the cluster. Create it but before that check
                    // if it's really needed (still registered in the cluster).
                    const stillNeeded = await context.service.stateGet(channelId);
                    if (stillNeeded) {
                        await context.log('info', `[RABBITMQ] Channel not locally open but desired in cluster. Creating channel ${channelId}.`);
                        if (connections.isConsumerConnection(channelId)) {
                            await connections.addConsumer(
                                context,
                                connectionParameters.queue,
                                connectionParameters.options,
                                connectionParameters.flowId,
                                connectionParameters.componentId,
                                connectionParameters.auth,
                                channelId
                            );
                        } else {
                            await connections.addProducer(
                                context,
                                connectionParameters.flowId,
                                connectionParameters.componentId,
                                connectionParameters.auth,
                                channelId
                            );
                        }
                    }
                }
            }

            // If the channel is live on this node but it is not desired anymore (not registered in the cluster), remove it.
            for (const channelId of Object.keys(openChannels)) {
                const channel = await context.service.stateGet(channelId);
                if (!channel) {
                    await context.log('info', `[RABBITMQ] Channel locally open but not desired in the cluster. Removing channel ${channelId}.`);
                    await connections.removeChannel(context, channelId);
                }
            }

        } catch (error) {
            await context.log('error', `[RABBITMQ] Error occurred during connection sync job: ${error.message}.`);
        } finally {
            isConnectionSyncInProgress = false;
        }
    });
};


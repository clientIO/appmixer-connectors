'use strict';
const connections = require('./connections');

module.exports = async (context) => {

    const config = require('./config')(context);

    await context.scheduleJob('reconnect', config.reconnectJob.schedule, async () => {

        const registeredComponents = await context.service.loadState();

        for (const component of registeredComponents) {
            await context.log('info', 'Reconnecting the component.');
            await connections.addConnection(context, component.value);
        }
    });

    await context.scheduleJob('disconnect', config.disconnectJob.schedule, async () => {

        const registeredComponents = await context.service.loadState();
        const registeredComponentsKeys = new Set(registeredComponents.map(item => item.key));

        for (const connectionId of connections.listConnections()) {
            if (!registeredComponentsKeys.has(connectionId)) {
                await connections.removeConnection({
                    flowId: connectionId.split(':')[0],
                    componentId: connectionId.split(':')[1]
                });
            }
        }
    });
};

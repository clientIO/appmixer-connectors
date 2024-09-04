'use strict';
const connections = require('./connections');

module.exports = (context) => {

    context.http.router.register({
        method: 'POST',
        path: '/consumers',
        options: {
            handler: async (req) => {

                const { flowId, componentId, queue, options, auth } = req.payload;
                const channelId = await connections.addConsumer(context, queue, options, flowId, componentId, auth);
                return { channelId };
            }
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/producers',
        options: {
            handler: async (req) => {

                const { flowId, componentId, auth } = req.payload;
                const channelId = await connections.addProducer(context, flowId, componentId, auth);
                return { channelId };
            }
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/producers/{channelId}/sendToQueue',
        options: {
            handler: async (req) => {

                const { flowId, componentId, channelId } = req.params;
                await connections.sendToQueue(context, flowId, componentId, channelId, req.payload);
                return {};
            }
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/producers/{channelId}/publish',
        options: {
            handler: async (req) => {

                const { flowId, componentId, channelId } = req.params;
                await connections.publish(context, flowId, componentId, channelId, req.payload);
                return {};
            }
        }
    });

    context.http.router.register({
        method: 'DELETE',
        path: '/producers/{channelId}',
        options: {
            handler: async (req) => {

                const { channelId } = req.params;
                await connections.removeChannel(context, channelId);
                return {};
            }
        }
    });

    context.http.router.register({
        method: 'DELETE',
        path: '/consumers/{channelId}',
        options: {
            handler: async (req) => {

                const { channelId } = req.params;
                await connections.removeChannel(context, channelId);
                return {};
            }
        }
    });
};

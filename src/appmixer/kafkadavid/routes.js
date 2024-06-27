'use strict';
const connections = require('./connections');

module.exports = (context) => {

    context.http.router.register({
        method: 'POST',
        path: '/consumers',
        options: {
            handler: async (req, h) => {

                const { flowId, componentId, topics, groupId, fromBeginning, auth } = req.payload;
                await connections.addConsumer(context, topics, flowId, componentId, groupId, fromBeginning, auth);
                return h.response({});
            }
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/producers',
        options: {
            handler: async (req, h) => {

                const { flowId, componentId, auth } = req.payload;
                await connections.addProducer(context, flowId, componentId, auth);
                return h.response({});
            }
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/producers/{flowId}/{componentId}/send',
        options: {
            handler: async (req, h) => {

                const { flowId, componentId } = req.params;
                await connections.sendMessage(flowId, componentId, req.payload);
                return h.response({});
            }
        }
    });

    context.http.router.register({
        method: 'DELETE',
        path: '/producers/{flowId}/{componentId}',
        options: {
            handler: async (req, h) => {

                const { flowId, componentId } = req.params;
                await connections.removeProducer(context, flowId, componentId);
                return h.response({});
            }
        }
    });

    context.http.router.register({
        method: 'DELETE',
        path: '/consumers/{flowId}/{componentId}',
        options: {
            handler: async (req, h) => {

                const { flowId, componentId } = req.params;
                await connections.removeConsumer(context, flowId, componentId);
                return h.response({});
            }
        }
    });
};

'use strict';
const connections = require('./connections');

module.exports = (context) => {

    context.http.router.register({
        method: 'POST',
        path: '/consumers',
        options: {
            handler: async (req) => {

                const { flowId, componentId, topics, groupId, fromBeginning, auth } = req.payload;
                // eslint-disable-next-line max-len
                const connectionId = await connections.addConsumer(context, topics, flowId, componentId, groupId, fromBeginning, auth);
                return { connectionId };
            }
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/producers',
        options: {
            handler: async (req) => {

                const { flowId, componentId, auth } = req.payload;
                const connectionId = await connections.addProducer(context, flowId, componentId, auth);
                return { connectionId };
            }
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/producers/{connectionId}/send',
        options: {
            handler: async (req) => {

                const { flowId, componentId, connectionId } = req.params;
                await connections.sendMessage(context, flowId, componentId, connectionId, req.payload);
                return {};
            }
        }
    });

    context.http.router.register({
        method: 'DELETE',
        path: '/producers/{connectionId}',
        options: {
            handler: async (req) => {

                const { connectionId } = req.params;
                await connections.removeConnection(context, connectionId);
                return {};
            }
        }
    });

    context.http.router.register({
        method: 'DELETE',
        path: '/consumers/{connectionId}',
        options: {
            handler: async (req) => {

                const { connectionId } = req.params;
                await connections.removeConnection(context, connectionId);
                return {};
            }
        }
    });
};

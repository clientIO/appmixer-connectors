'use strict';
const connections = require('./connections');

module.exports = (context) => {

    context.http.router.register({
        method: 'POST',
        path: '/connection',
        options: {
            handler: async (req, h) => {

                const { flowId, componentId } = req.payload;

                await context.service.stateSet(`${flowId}:${componentId}`, req.payload);
                await connections.addConnection(context, req.payload);
                return h.response({});
            }
        }
    });

    context.http.router.register({
        method: 'DELETE',
        path: '/connection/{flowId}/{componentId}',
        options: {
            handler: async (req, h) => {

                const { flowId, componentId } = req.params;

                await context.service.stateUnset(`${flowId}:${componentId}`);
                await connections.removeConnection({ flowId, componentId });
                return h.response({});
            }
        }
    });
};

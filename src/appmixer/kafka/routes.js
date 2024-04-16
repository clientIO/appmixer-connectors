'use strict';
const connections = require('./connections');

module.exports = (context) => {

    context.http.router.register({
        method: 'POST',
        path: '/connect/{mode}',
        options: {
            handler: async (req, h) => {

                const { flowId, componentId } = req.payload;
                if (req.params.mode === 'consumer') {
                    await connections.removeConnection({ flowId, componentId }, req.params.mode);
                }
                await context.service.stateSet(`${flowId}:${componentId}`, req.payload);
                await connections.addConnection(context, req.payload, req.params.mode);
                return h.response({});
            }
        }
    });

    context.http.router.register({
        method: 'DELETE',
        path: '/connect/{mode}/{flowId}/{componentId}',
        options: {
            handler: async (req, h) => {

                const { flowId, componentId, mode } = req.params;

                await context.service.stateUnset(`${flowId}:${componentId}`);
                await connections.removeConnection({ flowId, componentId }, mode);
                return h.response({});
            }
        }
    });
};

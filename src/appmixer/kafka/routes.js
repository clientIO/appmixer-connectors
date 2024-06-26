'use strict';
const connections = require('./connections');

module.exports = (context) => {

    context.http.router.register({
        method: 'POST',
        path: '/connect/{mode}',
        options: {
            handler: async (req, h) => {
                try {
                    const { flowId, componentId } = req.payload;
                    const { mode } = req.params;
                    if (mode === 'consumer') {
                        await connections.removeConnection({ flowId, componentId }, mode);
                    }
                    await connections.addConnection(context, req.payload, mode);
                    if (mode === 'producer') {
                        await connections.sendMessage({ flowId, componentId, payload: req.payload });
                    }

                    return h.response({});
                } catch (error) {
                    return h.response({ error }).code(400);
                }
            }
        }
    });

    context.http.router.register({
        method: 'DELETE',
        path: '/connect/{mode}/{flowId}/{componentId}',
        options: {
            handler: async (req, h) => {
                try {
                    const { flowId, componentId, mode } = req.params;
                    await context.service.stateUnset(`${flowId}:${componentId}`);
                    await connections.removeConnection({ flowId, componentId }, mode);
                    return h.response({});
                } catch (error) {
                    return h.response({ error }).code(400);
                }
            }
        }
    });
};

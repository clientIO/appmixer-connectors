'use strict';

const baseX = require('base-x').default;
const BASE62_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const base62 = baseX(BASE62_ALPHABET);

module.exports = (context) => {

    // Input definition (OnFlowCall).

    context.http.router.register({
        method: 'POST',
        path: '/input/{flowId}/{componentId}',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async (req) => {
                const { flowId, componentId } = req.params;
                const input = req.payload;
                input.createdAt = new Date();
                input.flowId = flowId;
                input.componentId = componentId;
                await context.service.stateSet(`subflows:input:${flowId}:${componentId}`, input);
                return {};
            }
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/input/{flowId}/{componentId}',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async (req) => {
                const { flowId, componentId } = req.params;
                const input = await context.service.stateGet(`subflows:input:${flowId}:${componentId}`);
                return input;
            }
        }
    });

    // Output definition (FlowCallOutput).

    context.http.router.register({
        method: 'POST',
        path: '/output/{flowId}/{componentId}',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async (req) => {
                const { flowId, componentId } = req.params;
                const output = req.payload;
                output.flowId = flowId;
                output.componentId = componentId;
                output.createdAt = new Date();
                await context.service.stateSet(`subflows:output:${flowId}`, output);
                return {};
            }
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/output/{flowId}',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async (req) => {
                const { flowId } = req.params;
                const output = await context.service.stateGet(`subflows:output:${flowId}`);
                return output;
            }
        }
    });

    // Trigger callee flow (i.e. trigger the OnFlowCall component).

    context.http.router.register({
        method: 'POST',
        path: '/trigger/{calleeFlowId}/{calleeComponentId}',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async (req) => {
                const { calleeFlowId, calleeComponentId } = req.params;
                const {
                    callerWebhookUrl,
                    payload
                } = req.payload;

                // Generate a correlationId to be able to track the message and be able
                // to call back the CallFlow component later in the callback (i.e. when FlowCallOutput is done).
                // Note that we use base62 since base64 is not URL safe. The base62 encoded string contains
                // the webhook URL of the callee.
                const correlationId = base62.encode(Buffer.from(callerWebhookUrl));

                await context.triggerComponent(
                    calleeFlowId,
                    calleeComponentId,
                    payload,
                    { enqueueOnly: 'true', correlationId }
                );

                return {
                    correlationId
                };
            }
        }
    });

    // Send flow output back to the caller. This is called by FlowCallOutput.

    context.http.router.register({
        method: 'POST',
        path: '/callback',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async (req) => {

                const correlationId = req.payload.correlationId;
                const payload = req.payload.payload;
                // The correlation ID is base62 encoded webhook URL of the CallFlow component.
                const callerWebhookUrl = Buffer.from(base62.decode(correlationId)).toString('utf8');

                await context.httpRequest({
                    method: 'POST',
                    url: callerWebhookUrl,
                    data: payload
                });
                return {};
            }
        }
    });
};

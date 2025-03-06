'use strict';

const crypto = require('crypto');

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
                await context.service.stateSet(`input:${flowId}:${componentId}`, input);
                context.log('info', '[UTILS.SUBFLOWS] Input Definition for flow ' + flowId + '/' + componentId + '; input: ' + JSON.stringify(input));
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
                const input = await context.service.stateGet(`input:${flowId}:${componentId}`);
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
                await context.service.stateSet(`output:${flowId}`, output);
                context.log('info', '[UTILS.SUBFLOWS] Output Definition for flow ' + flowId + '; output: ' + JSON.stringify(output));
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
                const output = await context.service.stateGet(`output:${flowId}`);
                return output;
            }
        }
    });

    // Trigger callee flow.

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
                    callerCorrelationId,
                    callerFlowId,
                    callerComponentId,
                    payload
                } = req.payload;

                // Generate a correlationId to be able to track the message and be able
                // to get ID of the caller component later in the callback (i.e. when FlowCallOutput is done).
                const correlationId = `${callerFlowId}:${callerComponentId}:${callerCorrelationId}:${crypto.randomUUID()}`;

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
        path: '/callback/{correlationId}',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async (req) => {

                const correlationId = req.params.correlationId;
                const [callerFlowId, callerComponentId, callerCorrelationId] = correlationId.split(':');

                const output = req.payload;

                await context.triggerComponent(
                    callerFlowId,
                    callerComponentId,
                    output.payload,
                    { enqueueOnly: 'true', correlationId: callerCorrelationId }
                );
                return {};
            }
        }
    });
};

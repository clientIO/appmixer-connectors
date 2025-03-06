'use strict';

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {

            const {
                flowId: calleeFlowId
            } = context.messages.in.content;

            const output = await context.callAppmixer({
                endPoint: `/plugins/appmixer/utils/subflows/output/${calleeFlowId}`,
                method: 'GET'
            });

            return this.generateOutputPortOptions(context, output);

        } else if (context.properties.generateInspector) {

            const {
                flowId: calleeFlowId,
                componentId: calleeComponentId
            } = context.messages.in.content;

            const input = await context.callAppmixer({
                endPoint: `/plugins/appmixer/utils/subflows/input/${calleeFlowId}/${calleeComponentId}`,
                method: 'GET'
            });

            return context.sendJson(input, 'out');

        } else if (context.messages.webhook) {

            // Callee flow finished, i.e. it reached the FlowCallOutput component.
            // Continue the flow. Note that the continuation of the flow is guaranteed
            // by the plugin (see the callback/ endpoint) that passes the correlationId
            // in the webhook call, the same correlationId that was used to trigger the
            // receive() method of this component.
            const payload = context.messages.webhook.content.data;
            const output = {};
            (payload || []).forEach(field => {
                output[field.name] = field.value;
            });
            // Payload should match the output options schema.
            return context.sendJson({ output }, 'out');
        }

        const {
            flowId: calleeFlowId,
            componentId: calleeComponentId
        } = context.messages.in.content;

        // Trigger the callee flow and wait for the webhook to arrive (see above).
        const payload = { ...context.messages.in.content };
        delete payload.flowId;
        delete payload.componentId;
        return context.callAppmixer({
            endPoint: `/plugins/appmixer/utils/subflows/trigger/${calleeFlowId}/${calleeComponentId}`,
            method: 'POST',
            body: {
                callerCorrelationId: context.messages.in.correlationId,
                callerFlowId: context.flowId,
                callerComponentId: context.componentId,
                payload
            }
        });
    },

    generateOutputPortOptions(context, output) {

        const options = [];
        const fields = output.fields;
        fields.forEach(field => {
            options.push({
                'label': field.name,
                'value': 'output.' + field.name,
                'schema': { 'type': field.type }
            });
        });
        return context.sendJson(options, 'out');
    },

    generateInspector(input) {

        const inspector = {
            inputs: {
                flowId: {
                    type: 'text',
                    label: 'Flow ID',
                    index: 1,
                    tooltip: 'Provide the flow ID to trigger the "On Flow Call" component inside it.'
                },
                componentId: {
                    type: 'text',
                    label: '"On Flow Call" Component ID',
                    index: 2,
                    tooltip: 'Provide the component ID of the "On Flow Call" component inside the flow that you intend to call.'
                }
            },
            groups: {
                input: {
                    label: 'Flow Input',
                    index: 2,
                    open: true
                }
            }
        };

        (input.fields || []).forEach((field, index) => {

            const inspectorType = ({
                'string': 'text',
                'number': 'number',
                'boolean': 'toggle',
                'array': 'text',
                'object': 'text'
            })[field.type] || 'text';

            inspector.inputs[field.name] = {
                type: inspectorType,
                label: field.name,
                group: 'input',
                index: index + 3  // Zero-based + position after the flowId.
            };
        });

        return inspector;
    }
};

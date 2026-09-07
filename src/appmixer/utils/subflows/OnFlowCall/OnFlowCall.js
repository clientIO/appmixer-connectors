'use strict';

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {

            // Output variables are generated dynamically based on the input definition.
            return this.generateOutputPortOptions(context);

        } else if (context.properties.triggerUpdate) {

            // This is a trick to trigger the update of the input fields
            // every time the expression inspector field changes.
            return this.shareInput(context);

        } else if (context.messages.webhook) {

            return context.sendJson({
                input: context.messages.webhook.content.data
            }, 'out');
        }

    },

    test(context) {

        // Sub-flow call trigger: there is no upstream to fetch. The output shape is defined
        // by the configured input fields (properties.input.ADD), mirrored by
        // generateOutputPortOptions(). Synthesize a single representative payload of the same
        // { input: { callerId, <field>: value, ... } } shape receive() emits.
        const fields = context.properties.input?.ADD || [];

        // callerId identifies the *calling* flow; in Test Mode there is no caller, so use an
        // explicit synthetic placeholder rather than this callee flow's id (context.flowId).
        const data = { callerId: 'test-caller-flow-id' };
        fields.forEach(field => {
            if (!field.name) {
                return;
            }
            switch (field.type) {
                case 'number': data[field.name] = 42; break;
                case 'boolean': data[field.name] = true; break;
                case 'object': data[field.name] = {}; break;
                case 'array': data[field.name] = []; break;
                default: data[field.name] = 'Sample text';
            }
        });

        return context.sendJson({ input: data }, 'out');
    },

    shareInput(context) {

        // Let the plugin know that the input definition changed so that all
        // 'Call Flow' components can read the input and generate their inspector
        // configuration accordingly.
        return context.callAppmixer({
            endPoint: `/plugins/appmixer/utils/subflows/input/${context.flowId}/${context.componentId}`,
            method: 'POST',
            body: {
                fields: context.properties.input?.ADD || []
            }
        });
    },

    generateOutputPortOptions(context) {

        const options = [{
            'label': 'Caller Flow ID',
            'value': 'callerId'
        }];

        const fields = context.properties.input?.ADD || [];
        fields.forEach(field => {
            options.push({
                'label': field.name,
                'value': 'input.' + field.name,
                'schema': { 'type': field.type }
            });
        });

        return context.sendJson(options, 'out');
    }
};

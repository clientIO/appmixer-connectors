'use strict';

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {

            return this.generateOutputPortOptions(context);

        } else if (context.properties.triggerUpdate) {

            // This is a trick to trigger the update of the output fields
            // every time the expression inspector field changes.
            return this.shareOutputDefinition(context);
        }

        // Send the output back to the caller flow.
        await this.sendOutputToCaller(context);

        // Let the flow continue.
        const payload = context.messages.in.content.output?.ADD || [];
        const output = {};
        (payload || []).forEach(field => {
            output[field.name] = field.value;
        });
        return context.sendJson({ output }, 'out');
    },

    sendOutputToCaller(context) {

        const correlationId = context.messages.in.correlationId;
        return context.callAppmixer({
            endPoint: `/plugins/appmixer/utils/subflows/callback/${correlationId}`,
            method: 'POST',
            body: {
                flowId: context.flowId,
                componentId: context.componentId,
                payload: context.messages.in.content.output?.ADD || []
            }
        });
    },

    shareOutputDefinition(context) {

        // Let the plugin know that the output definition changed so that all
        // 'Call Flow' components can read the output and generate their output
        // variables accordingly.

        return context.callAppmixer({
            endPoint: `/plugins/appmixer/utils/subflows/output/${context.flowId}/${context.componentId}`,
            method: 'POST',
            body: {
                fields: context.messages.in.content.output?.ADD || []
            }
        });
    },

    generateOutputPortOptions(context) {

        const options = [];
        const fields = context.messages.in.content.output?.ADD || [];
        fields.forEach(field => {
            options.push({
                'label': field.name,
                'value': 'output.' + field.name,
                'schema': { 'type': field.type }
            });
        });
        return context.sendJson(options, 'out');
    }
};

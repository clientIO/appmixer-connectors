'use strict';

module.exports = {

    receive: async function(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context);
        }
        const { toolCalls } = context.messages.in.originalContent;
        for (const toolCall of toolCalls) {
            // Process only those tool calls that are for this component.
            // This is because the AI Agent fans out all tool calls by using sendJson(..., 'tools').
            if (toolCall.componentId === context.componentId) {
                const out = { args: toolCall.args, toolCallId: toolCall.id };
                await context.flow.stateSet(context.componentId + ':' + context.messages.in.correlationId, toolCall.id);
                await context.sendJson(out, 'out');
            }
        }
    },

    getOutputPortOptions(context) {

        const options = [];
        const parameters = context.properties.parameters?.ADD || [];
        parameters.forEach(parameter => {
            options.push({ label: parameter.name, value: 'args.' + parameter.name, schema: { type: parameter.type } });
        });
        options.push({ label: 'Tool Call ID', value: 'toolCallId', schema: { type: 'string' } });
        return context.sendJson(options, 'out');
    }
};

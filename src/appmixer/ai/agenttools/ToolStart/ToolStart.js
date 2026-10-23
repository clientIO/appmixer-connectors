'use strict';

module.exports = {

    receive: async function(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context);
        }

        // Two ways in from the AI Agent's 'tools' port: the agent sends the tool calls through
        // the port to every ToolStart (context.messages.in) when the port holds ToolStarts only,
        // or calls this one ToolStart through its webhook URL (context.messages.webhook) when a
        // plain component is on the port too, so that the other tools stay untouched.
        const message = context.messages.webhook || context.messages.in;
        const { toolCalls, prompt } = context.messages.webhook
            ? (context.messages.webhook.content.data || {})
            : context.messages.in.originalContent;
        for (const toolCall of toolCalls || []) {
            // Process only those tool calls that are for this component.
            if (toolCall.componentId === context.componentId) {
                // The prompt is here as well: a chain called through the webhook URL does not
                // see the variables of the agent's port.
                const out = { args: toolCall.args, toolCallId: toolCall.id, prompt };
                // ToolOutput reads the tool call id under this key; the correlation id of the
                // message is inherited by every message of the chain.
                await context.flow.stateSet(context.componentId + ':' + message.correlationId, toolCall.id);
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
        options.push({ label: 'Prompt', value: 'prompt', schema: { type: 'string' } });
        return context.sendJson(options, 'out');
    }
};

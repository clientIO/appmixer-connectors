'use strict';

module.exports = {

    receive: async function(context) {

        // Find the toolCallId in the message scope, looking into the first
        // component with type 'appmixer.utils.ai.ToolStart' and taking
        // toolCallId from the output message that is stored in the flow state.
        const flowDescriptor = context.flowDescriptor;
        const scope = context.messages.in.scope;
        let toolCallId;
        for (const componentId of Object.keys(scope)) {
            const component = flowDescriptor[componentId];
            if (component && component.type === 'appmixer.ai.agenttools.ToolStart') {
                const key = componentId + ':' + context.messages.in.correlationId;
                toolCallId = await context.flow.stateGet(key);
                await context.flow.stateUnset(key);
            }
        }

        if (!toolCallId) {
            await context.log({ step: 'no-tool-call-id', scope, flowDescriptor });
            throw new context.CancelError('No toolCallId found in the scope. Are you sure you used ai.ToolStart to start your tool chain?');
        }

        await context.log({ step: 'tool-output', toolCallId, output: context.messages.in.content.output });
        // The AI agent expects to see the output in the flow state under the toolCallId key.
        return context.flow.stateSet(toolCallId, { output: context.messages.in.content.output });
    }
};

'use strict';

module.exports = {

    receive: async function(context) {

        // Find the toolCallId in the message scope, looking into the first
        // component with type 'appmixer.utils.ai.CallTool' and taking
        // toolCallId from the output message.
        const flowDescriptor = context.flowDescriptor;
        const scope = context.messages.in.scope;
        let toolCallId;
        Object.keys(scope).forEach(componentId => {
            const callToolOutputMessage = scope[componentId];
            const component = flowDescriptor[componentId];
            if (component && component.type === 'appmixer.utils.ai.CallTool') {
                toolCallId = callToolOutputMessage.out?.toolCallId;
            }
        });

        if (!toolCallId) {
            throw new context.CancelError('No toolCallId found in the scope. Are you sure you used ai.CallTool to start your tool chain?');
        }

        await context.log({ step: 'call-tool-output', toolCallId, output: context.messages.in.content.output });
        // The AI agent expects to see the output in the flow state under the toolCallId key.
        return context.flow.stateSet(toolCallId, { output: context.messages.in.content.output });
    }
};

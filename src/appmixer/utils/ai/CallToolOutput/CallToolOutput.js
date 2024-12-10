'use strict';

module.exports = {

    receive: async function(context) {

        await context.log({ step: 'call-tool-output', toolCallId: context.messages.in.correlationId, output: context.messages.in.content.output });
        // The AI agent expects to see the output in the service state under the toolCallId key.
        // correlationId is the toolCallId.
        return context.service.stateSet(context.messages.in.correlationId, context.messages.in.content.output);
    }
};

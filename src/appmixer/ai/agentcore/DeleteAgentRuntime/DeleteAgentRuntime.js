'use strict';

const { DeleteAgentRuntimeCommand } = require('@aws-sdk/client-bedrock-agentcore-control');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { agentRuntimeId } = context.messages.in.content;

        if (!agentRuntimeId) {
            throw new context.CancelError('Agent Runtime ID is required!');
        }

        const { controlClient } = lib.init(context);

        await controlClient.send(new DeleteAgentRuntimeCommand({ agentRuntimeId }));

        return context.sendJson({}, 'out');
    }
};

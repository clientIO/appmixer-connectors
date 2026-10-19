'use strict';

const { GetAgentRuntimeCommand } = require('@aws-sdk/client-bedrock-agentcore-control');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { agentRuntimeId, agentRuntimeVersion } = context.messages.in.content;

        if (!agentRuntimeId) {
            throw new context.CancelError('Agent Runtime ID is required!');
        }

        const { controlClient } = lib.init(context);

        const params = { agentRuntimeId };
        if (agentRuntimeVersion) {
            params.agentRuntimeVersion = agentRuntimeVersion;
        }

        const response = await controlClient.send(new GetAgentRuntimeCommand(params));

        return context.sendJson(response, 'out');
    }
};

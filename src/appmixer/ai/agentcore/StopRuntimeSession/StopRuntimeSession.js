'use strict';

const { StopRuntimeSessionCommand } = require('@aws-sdk/client-bedrock-agentcore');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { agentRuntimeArn, runtimeSessionId, qualifier } = context.messages.in.content;

        if (!agentRuntimeArn) {
            throw new context.CancelError('Agent Runtime ARN is required!');
        }
        if (!runtimeSessionId) {
            throw new context.CancelError('Runtime Session ID is required!');
        }

        const { dataClient } = lib.init(context);

        const params = { agentRuntimeArn, runtimeSessionId };
        if (qualifier) {
            params.qualifier = qualifier;
        }

        await dataClient.send(new StopRuntimeSessionCommand(params));

        return context.sendJson({}, 'out');
    }
};

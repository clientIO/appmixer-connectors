'use strict';

const { DeleteMemoryCommand } = require('@aws-sdk/client-bedrock-agentcore-control');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { memoryId } = context.messages.in.content;

        if (!memoryId) {
            throw new context.CancelError('Memory ID is required!');
        }

        const { controlClient } = lib.init(context);

        await controlClient.send(new DeleteMemoryCommand({ memoryId }));

        return context.sendJson({}, 'out');
    }
};

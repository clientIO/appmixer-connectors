'use strict';

const { DeleteMemoryRecordCommand } = require('@aws-sdk/client-bedrock-agentcore');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { memoryId, memoryRecordId } = context.messages.in.content;

        if (!memoryId) {
            throw new context.CancelError('Memory ID is required!');
        }
        if (!memoryRecordId) {
            throw new context.CancelError('Memory Record ID is required!');
        }

        const { dataClient } = lib.init(context);

        await dataClient.send(new DeleteMemoryRecordCommand({ memoryId, memoryRecordId }));

        return context.sendJson({}, 'out');
    }
};

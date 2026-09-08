'use strict';

const { GetMemoryRecordCommand } = require('@aws-sdk/client-bedrock-agentcore');
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

        const response = await dataClient.send(new GetMemoryRecordCommand({ memoryId, memoryRecordId }));

        return context.sendJson(response.memoryRecord || {}, 'out');
    }
};

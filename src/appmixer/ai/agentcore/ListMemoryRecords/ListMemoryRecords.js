'use strict';

const { ListMemoryRecordsCommand } = require('@aws-sdk/client-bedrock-agentcore');
const lib = require('../lib');

const schema = {
    'memoryRecordId': { 'type': 'string', 'title': 'Memory Record ID', 'example': 'mem-0000000000000000000000000000000000' },
    'memoryStrategyId': { 'type': 'string', 'title': 'Memory Strategy ID', 'example': 'semantic-abc1234567' },
    'content': { 'type': 'object', 'title': 'Content', 'example': { 'text': 'The user prefers dark mode.' } },
    'namespaces': { 'type': 'array', 'title': 'Namespaces', 'items': { 'type': 'string' }, 'example': ['/users/user-123'] },
    'createdAt': { 'type': 'string', 'format': 'date-time', 'title': 'Created At', 'example': '2025-01-15T10:30:00Z' }
};

module.exports = {

    async receive(context) {

        const { memoryId, namespace, memoryStrategyId, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Memory Records' });
        }

        if (!memoryId) {
            throw new context.CancelError('Memory ID is required!');
        }
        if (!namespace) {
            throw new context.CancelError('Namespace is required!');
        }

        const { dataClient } = lib.init(context);

        const records = [];
        let nextToken;
        do {
            const params = {
                memoryId,
                namespace,
                maxResults: 100,
                nextToken
            };
            if (memoryStrategyId) {
                params.memoryStrategyId = memoryStrategyId;
            }
            const response = await dataClient.send(new ListMemoryRecordsCommand(params));
            records.push(...(response.memoryRecordSummaries || []));
            nextToken = response.nextToken;
        } while (nextToken);

        return lib.sendArrayOutput({ context, outputType, records });
    }
};

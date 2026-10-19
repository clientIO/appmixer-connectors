'use strict';

const { ListMemoriesCommand } = require('@aws-sdk/client-bedrock-agentcore-control');
const lib = require('../lib');

const schema = {
    'id': { 'type': 'string', 'title': 'Memory ID', 'example': 'myMemory-abc1234567' },
    'arn': { 'type': 'string', 'title': 'Memory ARN', 'example': 'arn:aws:bedrock-agentcore:us-east-1:123456789012:memory/myMemory-abc1234567' },
    'status': { 'type': 'string', 'title': 'Status', 'example': 'ACTIVE' },
    'createdAt': { 'type': 'string', 'format': 'date-time', 'title': 'Created At', 'example': '2025-01-15T10:30:00Z' },
    'updatedAt': { 'type': 'string', 'format': 'date-time', 'title': 'Updated At', 'example': '2025-01-15T10:30:00Z' }
};

module.exports = {

    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Memories' });
        }

        const { controlClient } = lib.init(context);

        const records = [];
        let nextToken;
        do {
            const response = await controlClient.send(new ListMemoriesCommand({
                maxResults: 50,
                nextToken
            }));
            records.push(...(response.memories || []));
            nextToken = response.nextToken;
        } while (nextToken);

        return lib.sendArrayOutput({ context, outputType, records });
    }
};

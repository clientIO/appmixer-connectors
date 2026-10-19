'use strict';

const { ListSessionsCommand } = require('@aws-sdk/client-bedrock-agentcore');
const lib = require('../lib');

const schema = {
    'sessionId': { 'type': 'string', 'title': 'Session ID', 'example': 'session-1234567890abcdef' },
    'actorId': { 'type': 'string', 'title': 'Actor ID', 'example': 'user-123' },
    'createdAt': { 'type': 'string', 'format': 'date-time', 'title': 'Created At', 'example': '2025-01-15T10:30:00Z' }
};

module.exports = {

    async receive(context) {

        const { memoryId, actorId, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Sessions' });
        }

        if (!memoryId) {
            throw new context.CancelError('Memory ID is required!');
        }
        if (!actorId) {
            throw new context.CancelError('Actor ID is required!');
        }

        const { dataClient } = lib.init(context);

        const records = [];
        let nextToken;
        do {
            const response = await dataClient.send(new ListSessionsCommand({
                memoryId,
                actorId,
                maxResults: 100,
                nextToken
            }));
            records.push(...(response.sessionSummaries || []));
            nextToken = response.nextToken;
        } while (nextToken);

        return lib.sendArrayOutput({ context, outputType, records });
    }
};

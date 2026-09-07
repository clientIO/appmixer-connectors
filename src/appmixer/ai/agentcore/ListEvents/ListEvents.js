'use strict';

const { ListEventsCommand } = require('@aws-sdk/client-bedrock-agentcore');
const lib = require('../lib');

const schema = {
    'eventId': { 'type': 'string', 'title': 'Event ID', 'example': '0000000000000000000000000' },
    'actorId': { 'type': 'string', 'title': 'Actor ID', 'example': 'user-123' },
    'sessionId': { 'type': 'string', 'title': 'Session ID', 'example': 'session-1234567890abcdef' },
    'memoryId': { 'type': 'string', 'title': 'Memory ID', 'example': 'myMemory-abc1234567' },
    'eventTimestamp': { 'type': 'string', 'format': 'date-time', 'title': 'Event Timestamp', 'example': '2025-01-15T10:30:00Z' },
    'payload': { 'type': 'array', 'title': 'Payload', 'items': { 'type': 'object' }, 'example': [{ 'conversational': { 'role': 'USER', 'content': { 'text': 'Hello' } } }] }
};

module.exports = {

    async receive(context) {

        const { memoryId, actorId, sessionId, includePayloads, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Events' });
        }

        if (!memoryId) {
            throw new context.CancelError('Memory ID is required!');
        }
        if (!actorId) {
            throw new context.CancelError('Actor ID is required!');
        }
        if (!sessionId) {
            throw new context.CancelError('Session ID is required!');
        }

        const { dataClient } = lib.init(context);

        const records = [];
        let nextToken;
        do {
            const response = await dataClient.send(new ListEventsCommand({
                memoryId,
                actorId,
                sessionId,
                includePayloads: includePayloads !== false,
                maxResults: 100,
                nextToken
            }));
            records.push(...(response.events || []));
            nextToken = response.nextToken;
        } while (nextToken);

        return lib.sendArrayOutput({ context, outputType, records });
    }
};

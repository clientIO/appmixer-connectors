'use strict';

const { ListAgentRuntimesCommand } = require('@aws-sdk/client-bedrock-agentcore-control');
const lib = require('../lib');

const schema = {
    'agentRuntimeId': { 'type': 'string', 'title': 'Agent Runtime ID', 'example': 'myAgent-abc1234567' },
    'agentRuntimeArn': { 'type': 'string', 'title': 'Agent Runtime ARN', 'example': 'arn:aws:bedrock-agentcore:us-east-1:123456789012:agent/00000000-0000-0000-0000-000000000000:1' },
    'agentRuntimeName': { 'type': 'string', 'title': 'Name', 'example': 'myAgent' },
    'agentRuntimeVersion': { 'type': 'string', 'title': 'Version', 'example': '1' },
    'description': { 'type': 'string', 'title': 'Description', 'example': 'My production agent runtime' },
    'status': { 'type': 'string', 'title': 'Status', 'example': 'READY' },
    'lastUpdatedAt': { 'type': 'string', 'format': 'date-time', 'title': 'Last Updated At', 'example': '2025-01-15T10:30:00Z' }
};

module.exports = {

    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Agent Runtimes' });
        }

        const { controlClient } = lib.init(context);

        const records = [];
        let nextToken;
        do {
            const response = await controlClient.send(new ListAgentRuntimesCommand({
                maxResults: 100,
                nextToken
            }));
            records.push(...(response.agentRuntimes || []));
            nextToken = response.nextToken;
        } while (nextToken);

        return lib.sendArrayOutput({ context, outputType, records });
    }
};

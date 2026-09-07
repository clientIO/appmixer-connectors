'use strict';

const { ListAgentRuntimeEndpointsCommand } = require('@aws-sdk/client-bedrock-agentcore-control');
const lib = require('../lib');

const schema = {
    'id': { 'type': 'string', 'title': 'Endpoint ID', 'example': 'endpoint-abc1234567' },
    'name': { 'type': 'string', 'title': 'Name', 'example': 'DEFAULT' },
    'agentRuntimeEndpointArn': { 'type': 'string', 'title': 'Endpoint ARN', 'example': 'arn:aws:bedrock-agentcore:us-east-1:123456789012:agent/00000000-0000-0000-0000-000000000000/runtime-endpoint/DEFAULT' },
    'agentRuntimeArn': { 'type': 'string', 'title': 'Agent Runtime ARN', 'example': 'arn:aws:bedrock-agentcore:us-east-1:123456789012:agent/00000000-0000-0000-0000-000000000000:1' },
    'status': { 'type': 'string', 'title': 'Status', 'example': 'READY' },
    'liveVersion': { 'type': 'string', 'title': 'Live Version', 'example': '1' },
    'targetVersion': { 'type': 'string', 'title': 'Target Version', 'example': '1' },
    'description': { 'type': 'string', 'title': 'Description', 'example': 'Default endpoint' },
    'createdAt': { 'type': 'string', 'format': 'date-time', 'title': 'Created At', 'example': '2025-01-15T10:30:00Z' },
    'lastUpdatedAt': { 'type': 'string', 'format': 'date-time', 'title': 'Last Updated At', 'example': '2025-01-15T10:30:00Z' }
};

module.exports = {

    async receive(context) {

        const { agentRuntimeId, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Endpoints' });
        }

        if (!agentRuntimeId) {
            throw new context.CancelError('Agent Runtime ID is required!');
        }

        const { controlClient } = lib.init(context);

        const records = [];
        let nextToken;
        do {
            const response = await controlClient.send(new ListAgentRuntimeEndpointsCommand({
                agentRuntimeId,
                maxResults: 100,
                nextToken
            }));
            records.push(...(response.runtimeEndpoints || []));
            nextToken = response.nextToken;
        } while (nextToken);

        return lib.sendArrayOutput({ context, outputType, records });
    }
};

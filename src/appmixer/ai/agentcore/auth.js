'use strict';

const { BedrockAgentCoreControlClient, ListAgentRuntimesCommand } = require('@aws-sdk/client-bedrock-agentcore-control');

module.exports = {

    type: 'apiKey',

    definition: {

        accountNameFromProfileInfo: 'accessKeyId',

        auth: {
            accessKeyId: {
                type: 'text',
                name: 'AWS Access Key ID',
                tooltip: 'Your AWS access key ID.'
            },
            secretKey: {
                type: 'text',
                name: 'AWS Secret Access Key',
                tooltip: 'Your AWS secret access key.'
            },
            region: {
                type: 'text',
                name: 'AWS Region',
                tooltip: 'The AWS region where your AgentCore resources live, e.g. <b>us-east-1</b>.'
            },
            sessionToken: {
                type: 'text',
                name: 'AWS Session Token',
                tooltip: 'Optional. Provide a session token when using temporary (STS) credentials.'
            }
        },

        validate: async context => {

            const credentials = {
                accessKeyId: context.accessKeyId,
                secretAccessKey: context.secretKey
            };
            if (context.sessionToken) {
                credentials.sessionToken = context.sessionToken;
            }

            const client = new BedrockAgentCoreControlClient({
                region: context.region || 'us-east-1',
                credentials
            });

            // Lightweight control-plane read to verify credentials + region.
            await client.send(new ListAgentRuntimesCommand({ maxResults: 1 }));

            return true;
        }
    }
};

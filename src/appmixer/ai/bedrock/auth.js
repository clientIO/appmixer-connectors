'use strict';

const { BedrockClient, ListFoundationModelsCommand } = require('@aws-sdk/client-bedrock');

module.exports = {

    type: 'apiKey',

    definition: {

        accountNameFromProfileInfo: 'accessKeyId',

        auth: {
            accessKeyId: {
                type: 'text',
                name: 'Access Key Id',
                tooltip: 'Your AWS access key ID'
            },
            secretKey: {
                type: 'text',
                name: 'Secret Key',
                tooltip: 'Your AWS secret access key'
            }
        },

        validate: async context => {

            const bedrockClient = new BedrockClient({
                region: 'us-east-1',
                credentials: {
                    accessKeyId: context.accessKeyId,
                    secretAccessKey: context.secretKey
                }
            });

            const command = new ListFoundationModelsCommand({});
            const response = await bedrockClient.send(command);

            return response.modelSummaries;
        }
    }
};

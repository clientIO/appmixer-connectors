'use strict';

const { BedrockClient, ListFoundationModelsCommand } = require('@aws-sdk/client-bedrock');


module.exports = {

    receive: async function(context) {

        const bedrockClient = new BedrockClient({
            region: context.messages.in.content.region || 'us-east-1',
            credentials: {
                accessKeyId: context.auth.accessKeyId,
                secretAccessKey: context.auth.secretKey
            }
        });

        const command = new ListFoundationModelsCommand({});
        const response = await bedrockClient.send(command);

        return context.sendJson({ models: response.modelSummaries }, 'out');
    },

    toSelectOptions(out) {
        return out.models.map(model => {
            return { label: `${model.modelName} (${model.modelId})`, value: model.modelId };
        });
    }
};

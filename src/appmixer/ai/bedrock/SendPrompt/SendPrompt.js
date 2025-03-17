'use strict';

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

module.exports = {

    receive: async function(context) {

        const { input = {}, region, model } = context.messages.in.content;

        const bedrockClient = new BedrockRuntimeClient({
            region: region || 'us-east-1',
            credentials: {
                accessKeyId: context.auth.accessKeyId,
                secretAccessKey: context.auth.secretKey
            }
        });

        const payload = {};
        (input?.ADD || []).forEach(field => {
            let value = field.value;

            switch (field.type) {
                case 'number':
                    value = parseFloat(value);
                    break;
                case 'boolean':
                    value = Boolean(value);
                    break;
                case 'array':
                    value = Array.isArray(value) ? value : JSON.parse(value);
                    break;
                case 'object':
                    value = typeof value === 'object' ? value : JSON.parse(value);
                    break;
            }
            payload[field.key] = value;
        });

        const params = {
            modelId: model,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(payload)
        };

        const command = new InvokeModelCommand(params);

        let response;
        try {
            response = await bedrockClient.send(command);
        } catch (err) {
            // Re-throw with just the error message. Otherwise a
            // [unable to serialize, circular reference is too complex to analyze]
            // error is thrown.
            throw new context.CancelError(err.message);
        }

        const result = JSON.parse(Buffer.from(response.body).toString('utf-8'));
        return context.sendJson({ result, input }, 'out');
    }
};

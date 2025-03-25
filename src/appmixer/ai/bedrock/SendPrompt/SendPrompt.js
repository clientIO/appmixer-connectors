'use strict';

const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');

module.exports = {

    receive: async function(context) {

        const { prompt, customInput = {}, region, model } = context.messages.in.content;

        const client = new BedrockRuntimeClient({
            region: region || 'us-east-1',
            credentials: {
                accessKeyId: context.auth.accessKeyId,
                secretAccessKey: context.auth.secretKey
            }
        });

        const request = {
            modelId: model,
            messages: [{
                role: 'user',
                content: [{
                    text: prompt
                }]
            }]
        };

        (customInput?.ADD || []).forEach(field => {

            if (!field.key) return;
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
            request[field.key] = value;
        });

        await context.log({ step: 'invoke-model', request });
        const command = new ConverseCommand(request);

        let response;
        try {
            response = await client.send(command);
        } catch (err) {
            // Re-throw with just the error message. Otherwise a
            // [unable to serialize, circular reference is too complex to analyze]
            // error is thrown.
            throw new context.CancelError(err.message);
        }

        const answer = response.output.message.content[0].text;
        return context.sendJson({ answer, input: request }, 'out');
    }
};

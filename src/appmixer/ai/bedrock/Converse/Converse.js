'use strict';

// https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/bedrock-runtime/command/ConverseCommand/

const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');

module.exports = {

    receive: async function(context) {

        const { messages = {}, customInput = {}, region, model } = context.messages.in.content;

        const client = new BedrockRuntimeClient({
            region: region || 'us-east-1',
            credentials: {
                accessKeyId: context.auth.accessKeyId,
                secretAccessKey: context.auth.secretKey
            }
        });

        const payload = {};
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
            payload[field.key] = value;
        });

        const content = [];

        for (const message of messages?.ADD || []) {
            const {
                type,
                text,
                imageFormat,
                documentFormat,
                videoFormat,
                documentName,
                fileId,
                s3ObjectBucket,
                s3ObjectKey
            } = message;

            const contentBlock = {};

            switch (type) {
                case 'text':
                    contentBlock.text = text;
                    break;
                case 'image':
                    contentBlock.image = {
                        format: imageFormat,
                        source: {
                            bytes: await context.loadFile(fileId)
                        }
                    };
                    break;
                case 'document':
                    contentBlock.document = {
                        format: documentFormat,
                        name: documentName,
                        source: {
                            bytes: await context.loadFile(fileId)
                        }
                    };
                    break;
                case 'video':
                    contentBlock.video = {
                        format: videoFormat
                    };
                    if (fileId) {
                        contentBlock.video.source = {
                            bytes: await context.loadFile(fileId)
                        };
                    } else {
                        contentBlock.video.source = {
                            s3Location: {
                                uri: `s3://${s3ObjectBucket}/${s3ObjectKey}`
                            }
                        };
                    }
                    break;
            }
            content.push(contentBlock);
        }

        const params = {
            modelId: model,
            messages: [{
                role: 'user',
                content
            }]
        };

        await context.log({ step: 'invoke-model', params });
        const command = new ConverseCommand(params);

        let response;
        try {
            response = await client.send(command);
        } catch (err) {
            // Re-throw with just the error message. Otherwise a
            // [unable to serialize, circular reference is too complex to analyze]
            // error is thrown.
            throw new context.CancelError(err.message);
        }

        return context.sendJson({ response, input: payload }, 'out');
    }
};

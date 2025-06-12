'use strict';

const lib = require('../lib');

module.exports = {

    receive: async function(context) {

        const { text, jsonSchema: jsonSchemaString, model } = context.messages.in.content;

        let jsonSchema;
        try {
            jsonSchema = JSON.parse(jsonSchemaString);
        } catch (error) {
            throw new context.CancelError(`Invalid JSON schema: ${error.message}`);
        }

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, jsonSchema);
        }

        const { data } = await lib.request(context, 'post', '/chat/completions', {
            model: model || 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert at structured data extraction. You will be given unstructured text and should convert it into the given structure.',
                    name: 'system'
                },
                {
                    role: 'user',
                    content: text,
                    name: 'user'
                }
            ],
            response_format: {
                type: 'json_schema',
                json_schema: {
                    name: 'json_extraction',
                    schema: jsonSchema
                }
            }
        });

        const json = JSON.parse(data.choices[0].message.content);
        return context.sendJson({ json }, 'out');
    },

    getOutputPortOptions: function(context, jsonSchema) {

        return context.sendJson([
            {
                value: 'json',
                label: 'JSON',
                schema: jsonSchema
            },
            {
                value: 'text',
                label: 'Text',
                schema: { type: 'string' }
            }
        ], 'out');
    }
};

'use strict';

module.exports = {

    receive: async function(context) {

        const { text, jsonSchema: jsonSchemaString, model } = context.messages.in.content;

        const jsonSchema = JSON.parse(jsonSchemaString);

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, jsonSchema);
        }

        const apiKey = context.auth.apiKey;

        const url = 'https://api.openai.com/v1/chat/completions';
        const { data } = await context.httpRequest.post(url, {
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
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
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

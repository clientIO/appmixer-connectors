'use strict';

const lib = require('../lib');

module.exports = {

    receive: async function(context) {

        const { text, jsonSchema: jsonSchemaString, model } = context.messages.in.content;

        const jsonSchema = JSON.parse(jsonSchemaString);

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, jsonSchema);
        }

        const config = {
            apiKey: context.auth.apiKey,
            baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
        };
        const json = await lib.transformTextToJSON(config, { prompt: text, jsonSchema, model });
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

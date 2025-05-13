/* eslint-disable camelcase */
'use strict';

module.exports = {

    receive: async function(context) {

        const { text, jsonSchema: jsonSchemaString, model, max_tokens } = context.messages.in.content;
        let jsonSchema;
        try {
            jsonSchema = JSON.parse(jsonSchemaString);
        } catch (error) {
            throw new context.CancelError(`Invalid JSON schema: ${error.message}`);
        }

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, jsonSchema);
        }

        const config = {
            apiKey: context.auth.apiKey,
            baseURL: 'https://api.anthropic.com/v1/'
        };

        const json = await this.transformTextToJSON(context, config, { prompt: text, jsonSchema, model, max_tokens });

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
    },

    /**
     * Calls Anthropic Claude API to transform text to JSON using tool schema.
     * @param {Object} config - { apiKey, baseURL }
     * @param {Object} input - { prompt, jsonSchema, model }
     * @returns {Object} JSON object following the schema
     */
    transformTextToJSON: async function(context, config, input) {

        const { prompt, jsonSchema, model, max_tokens } = input;
        const toolName = 'extract_json';
        const tools = [{
            name: toolName,
            description: 'Extract structured data from text as JSON according to the provided schema.',
            input_schema: jsonSchema
        }];
        const messages = [
            { role: 'user', content: [{ type: 'text', text: prompt }] }
        ];
        const body = {
            model,
            max_tokens,
            tools,
            tool_choice: { type: 'tool', name: toolName },
            messages
        };
        const response = await context.httpRequest.post(
            config.baseURL + 'messages',
            body,
            {
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': config.apiKey,
                    'anthropic-version': '2023-06-01'
                }
            }
        );
        // Find the tool_use output in the response
        const toolUse = response.data.content.find(
            c => c.type === 'tool_use' && c.name === toolName
        );
        if (!toolUse) throw new Error('Claude did not return tool_use output.');
        return toolUse.input;
    }
};

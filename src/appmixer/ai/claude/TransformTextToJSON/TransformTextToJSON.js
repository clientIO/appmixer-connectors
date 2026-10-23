/* eslint-disable camelcase */
'use strict';

const USAGE_SCHEMA = {
    type: 'object',
    properties: {
        input_tokens: { type: 'integer', title: 'Input Tokens', example: 412 },
        output_tokens: { type: 'integer', title: 'Output Tokens', example: 87 },
        cache_creation_input_tokens: { type: 'integer', title: 'Cache Creation Input Tokens', example: 0 },
        cache_read_input_tokens: { type: 'integer', title: 'Cache Read Input Tokens', example: 0 }
    },
    example: { input_tokens: 412, output_tokens: 87, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
};

module.exports = {

    receive: async function(context) {

        const { text, jsonSchema: jsonSchemaString, model, max_tokens } = context.messages.in.content;
        if (!text) {
            throw new context.CancelError('Text is required');
        }

        if (!jsonSchemaString) {
            throw new context.CancelError('Output JSON Schema is required');
        }

        if (!model) {
            throw new context.CancelError('Model is required');
        }

        if (!max_tokens) {
            throw new context.CancelError('Max Tokens is required');
        }


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

        const result = await this.transformTextToJSON(context, config, { prompt: text, jsonSchema, model, max_tokens });

        return context.sendJson(result, 'out');
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
            },
            {
                value: 'usage',
                label: 'Usage',
                schema: USAGE_SCHEMA
            },
            {
                value: 'stop_reason',
                label: 'Stop Reason',
                schema: { type: 'string', example: 'tool_use' }
            },
            {
                value: 'model',
                label: 'Model',
                schema: { type: 'string', example: 'claude-sonnet-4-5-20250929' }
            }
        ], 'out');
    },

    /**
     * Calls Anthropic Claude API to transform text to JSON using tool schema.
     * @param {Object} config - { apiKey, baseURL }
     * @param {Object} input - { prompt, jsonSchema, model }
     * @returns {Object} { json, usage, stop_reason, model } where json follows the schema
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
        const { content, usage, stop_reason, model: responseModel } = response.data;
        const toolUse = (content || []).find(
            c => c.type === 'tool_use' && c.name === toolName
        );
        // When the response is cut off by max_tokens, the tool_use block can be missing or incomplete.
        // Return what we have so the flow can detect it via stop_reason.
        if (!toolUse && stop_reason !== 'max_tokens') {
            throw new Error('Claude did not return tool_use output.');
        }
        return {
            json: toolUse?.input || {},
            usage,
            stop_reason,
            model: responseModel
        };
    }
};

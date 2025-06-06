const OpenAI = require('openai');

module.exports = {

    request: async function(context, method, endpoint, data, options = {}, extraHeaders = {}) {

        const baseUrl = context.config.llmBaseUrl || 'https://api.openai.com/v1';
        const url = baseUrl + endpoint;
        const headers = {
            'Authorization': `Bearer ${context.apiKey || context.auth.apiKey}`,
            'Content-Type': 'application/json',
            ...extraHeaders
        };
        if (context.config.llmDefaultHeaders) {
            const defaultHeaders = JSON.parse(context.config.llmDefaultHeaders);
            Object.keys(defaultHeaders).forEach(key => {
                headers[key] = defaultHeaders[key];
            });
        }
        if (method === 'get' || method === 'delete') {
            return context.httpRequest[method](url, { headers });
        } else {
            return context.httpRequest[method](url, data, {
                headers,
                ...options
            });
        }
    },

    sdk: function(context) {

        const apiKey = context.apiKey || context.auth.apiKey;
        const opt = { apiKey };
        if (context.config.llmBaseUrl) {
            // Allow for re-using the OpenAI connector with different OpenAI compatible LLMs.
            // For example, for OpenRouter, set 'https://openrouter.ai/api/v1'.
            opt.baseUrl = context.config.llmBaseUrl;
        }
        if (context.config.llmDefaultHeaders) {
            // For example, for OpenRouter, set:
            // {
            //    "HTTP-Referer": "<YOUR_SITE_URL>", // Optional. Site URL for rankings on openrouter.ai.
            //    "X-Title": "<YOUR_SITE_NAME>", // Optional. Site title for rankings on openrouter.ai.
            // }
            try {
                opt.defaultHeaders = JSON.parse(context.config.llmDefaultHeaders);
            } catch (err) {
                throw new Error('Invalid JSON in config.llmDefaultHeaders: ' + err.message);
            }
        }
        return new OpenAI(opt);
    },

    publish: function(channel, event) {

        const redisPub = process.CONNECTOR_STREAM_PUB_CLIENT;
        if (redisPub) {
            return redisPub.publish(channel, JSON.stringify(event));
        }
    }
};

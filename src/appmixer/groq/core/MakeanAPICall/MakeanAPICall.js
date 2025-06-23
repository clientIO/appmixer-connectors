'use strict';

module.exports = {
    async receive(context) {

        const { method, url, headers, body } = context.messages.in.content;

        // https://console.groq.com/docs/api-reference#api-call
        const { data } = await context.httpRequest({
            method: method,
            url: `https://api.groq.com/v1/${url}`,
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`,
                ...headers // Spread any additional headers provided in the input
            },
            data: body || null // Use body if provided, otherwise null
        });

        return context.sendJson(data, 'out');
    }
};

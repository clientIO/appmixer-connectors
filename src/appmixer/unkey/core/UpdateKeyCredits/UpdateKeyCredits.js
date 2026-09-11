'use strict';

module.exports = {
    async receive(context) {
        const { keyId, operation, value } = context.messages.in.content;

        if (!keyId) {
            throw new context.CancelError('Key ID is required!');
        }

        if (!operation) {
            throw new context.CancelError('Operation is required!');
        }

        if (value === undefined || value === null) {
            throw new context.CancelError('Value is required!');
        }

        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.unkey.com/v2/keys.updateCredits',
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/json'
            },
            data: {
                keyId,
                operation,
                value
            }
        });

        // v2 returns the key's credits directly in `data` ({ remaining, refill }).
        return context.sendJson({
            credits: data.data?.remaining ?? null,
            refill: data.data?.refill ?? null
        }, 'out');
    }
};

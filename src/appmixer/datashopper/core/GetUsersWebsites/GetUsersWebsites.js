'use strict';

module.exports = {
    async receive(context) {
        const { baseUrl, apiKey } = context.auth;
        const { isSource } = context.properties;
        const email = context.userInfo.username;

        const response = await context.httpRequest({
            method: 'POST',
            url: `${baseUrl}/api/v2/websites/by-email`,
            headers: {
                'X-API-Key': apiKey,
                'Content-Type': 'application/json'
            },
            data: {
                email
            }
        });

        if (response.data.success) {
            if (isSource) {
                return context.sendJson({ websites: response.data.data }, 'out');
            }
            return context.sendArray(response.data.data, 'out');
        } else {
            throw new context.CancelError("Failed to fetch websites");
        }
    },

    websitesToSelectArray({ websites }) {
        return (websites || []).map(website => ({
            label: website.label,
            value: website.value
        }));
    }
};

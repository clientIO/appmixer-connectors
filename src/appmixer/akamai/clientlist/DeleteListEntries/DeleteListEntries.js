'use strict';

const { generateAuthorizationHeader, parseIPs } = require('../../lib');

module.exports = {
    receive: async (context) => {
        const { hostnameUrl, accessToken, clientSecret, clientToken } =
            context.auth;
        const { listId, value } = context.messages.in.content;

        const ips = parseIPs(value);

        const body = {
            delete: ips.map(ip => ({ value: ip }))
        };

        const {
            url,
            method,
            headers: { Authorization }
        } = generateAuthorizationHeader({
            hostnameUrl,
            accessToken,
            clientToken,
            clientSecret,
            method: 'POST',
            path: `/client-list/v1/lists/${listId}/items`,
            body
        });

        const { data } = await context.httpRequest({
            url,
            method,
            headers: { Authorization },
            data: body
        });

        return context.sendJson(data, 'out');
    }
};

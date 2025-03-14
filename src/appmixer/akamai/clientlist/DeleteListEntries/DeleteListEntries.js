'use strict';

const { generateAuthorizationHeader } = require('../../signature');

module.exports = {
    receive: async (context) => {
        const { hostnameUrl, accessToken, clientSecret, clientToken } =
            context.auth;
        const { listId, value } = context.messages.in.content;

        const deleteArr = [];

        const ips = value.split(',');

        ips.forEach(ip => {
            ip = ip.trim();

            deleteArr.push({ value: ip });
        });

        const body = {
            delete: deleteArr
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

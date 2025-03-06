'use strict';

const { generateAuthorizationHeader } = require('../../signature');

module.exports = {
    receive: async function (context) {
        const { hostnameUrl, accessToken, clientSecret, clientToken } =
            context.auth;
        const { listId, action, network, comments } =
            context.messages.in.content;

        const body = { action, network, comments };

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
            path: `/client-list/v1/lists/${listId}/activations`,
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

'use strict';

const { generateAuthorizationHeader } = require('../../signature');

module.exports = {

    receive: async function(context) {
        const { hostnameUrl, accessToken, clientSecret, clientToken } = context.auth;
        const { listId } = context.messages.in.content;
        const { url, method, headers: { Authorization } } = generateAuthorizationHeader(
            {
                hostnameUrl,
                accessToken,
                clientToken,
                clientSecret,
                method: 'GET',
                path: `/client-list/v1/lists/${listId}/items`
            }
        );

        const { data } = await context.httpRequest(
            { url, method, headers: { Authorization } }
        );

        const { content } = data;

        return context.sendArray(content, 'out');
    }
};

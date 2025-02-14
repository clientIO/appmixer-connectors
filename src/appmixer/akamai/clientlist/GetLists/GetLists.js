'use strict';

const { generateAuthorizationHeader } = require('../../signature');

module.exports = {

    receive: async function(context) {
        const { hostnameUrl, accessToken, clientSecret, clientToken } = context.auth;
        const { url, method, headers: { Authorization } } = generateAuthorizationHeader(
            {
                hostnameUrl,
                accessToken,
                clientToken,
                clientSecret,
                method: 'GET',
                path: '/client-list/v1/lists'
            }
        );

        const { data } = await context.httpRequest(
            { url, method, headers: { Authorization } }
        );

        const { content } = data;

        return context.sendJson(content, 'out');
    },

    listsToSelectArray(lists) {

        return lists.map(list => {
            return { label: list.name, value: list.listId };
        });
    }
};

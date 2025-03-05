'use strict';

const { generateAuthorizationHeader } = require('../../signature');

module.exports = {

    receive: async function(context) {
        const { hostnameUrl, accessToken, clientSecret, clientToken } = context.auth;
        const { listId, deleteEntries } = context.messages.in.content;
        context.log({ step: 'deleteEntries', deleteEntries });


        const deleteArr = deleteEntries.ADD.map((entry) => {
            return {
                ...entry,
                tags: entry.tags?.split(',')
            };
        });
        const body = {
            delete: deleteArr
        };

        context.log({ step: 'body', body });

        const { url, method, headers: { Authorization } } = generateAuthorizationHeader(
            {
                hostnameUrl,
                accessToken,
                clientToken,
                clientSecret,
                method: 'POST',
                path: `/client-list/v1/lists/${listId}/items`,
                body
            }
        );

        const { data } = await context.httpRequest(
            { url, method, headers: { Authorization }, data: body }
        );

        return context.sendJson(data, 'out');
    }
};

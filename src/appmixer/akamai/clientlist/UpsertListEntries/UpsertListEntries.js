'use strict';

const { generateAuthorizationHeader } = require('../../signature');

module.exports = {

    receive: async function(context) {
        const { hostnameUrl, accessToken, clientSecret, clientToken } = context.auth;
        const { listId, upsert } = context.messages.in.content;
        context.log({ step: 'upsert', upsert });

        const {
            url: getItemsUrl,
            method: getItemsMethod,
            headers: { Authorization: getItemsAuthorization }
        } = generateAuthorizationHeader(
            {
                hostnameUrl,
                accessToken,
                clientToken,
                clientSecret,
                method: 'GET',
                path: `/client-list/v1/lists/${listId}/items`
            }
        );

        const { data: listEntries } = await context.httpRequest(
            { url: getItemsUrl, method: getItemsMethod, headers: { Authorization: getItemsAuthorization } }
        );

        context.log({ step: 'listEntries data', listEntries });

        const currentEntries = listEntries.content.map((entry) => entry.value);

        context.log({ step: 'currentEntries data', currentEntries });

        const appendArr = [];
        const updateArr = [];
        upsert.ADD.forEach((entry) => {
            entry.tags = entry.tags?.split(',');
            if (currentEntries.includes(entry.value)) {
                updateArr.push(entry);
            } else {
                appendArr.push(entry);
            }
        });
        const body = {
            append: appendArr,
            update: updateArr
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

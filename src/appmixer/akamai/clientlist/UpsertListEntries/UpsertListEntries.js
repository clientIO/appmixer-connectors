'use strict';

const { generateAuthorizationHeader } = require('../../signature');

module.exports = {
    receive: async (context) => {
        const { hostnameUrl, accessToken, clientSecret, clientToken } =
            context.auth;
        const { listId, upsert } = context.messages.in.content;

        const {
            url: getItemsUrl,
            method: getItemsMethod,
            headers: { Authorization: getItemsAuthorization }
        } = generateAuthorizationHeader({
            hostnameUrl,
            accessToken,
            clientToken,
            clientSecret,
            method: 'GET',
            path: `/client-list/v1/lists/${listId}/items`
        });

        const { data: listEntries } = await context.httpRequest({
            url: getItemsUrl,
            method: getItemsMethod,
            headers: { Authorization: getItemsAuthorization }
        });

        const currentEntries = listEntries.content.map((entry) => entry.value);

        const appendArr = [];
        const updateArr = [];
        upsert.ADD.forEach((entry) => {
            const entryIndex = currentEntries.findIndex(
                (e) => e === entry.value
            );
            entry.expirationDate = entry.expirationDate
                ? new Date().getTime() + entry.expirationDate * 1000
                : undefined;
            const newTags = entry.tags?.split(',');
            if (entryIndex > -1) {
                entry.tags =
                    listEntries.content[entryIndex].tags.concat(newTags);
                updateArr.push(entry);
            } else {
                entry.tags = newTags;
                appendArr.push(entry);
            }
        });
        const body = {
            append: appendArr,
            update: updateArr
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

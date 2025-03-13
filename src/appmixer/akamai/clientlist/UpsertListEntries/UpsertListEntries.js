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
            entry.expirationDate = entry.expirationDate
                ? new Date().getTime() + entry.expirationDate * 1000
                : undefined;
            const ips = entry.value.split(',');

            if (ips.length === 1) {
                const entryIndex = currentEntries.findIndex(
                    (e) => e === entry.value
                );
                if (entryIndex > -1) {
                } else {
                    appendArr.push(entry);
                }
            } else {
                ips.forEach(ip => {
                    ip = ip.trim();
                    const ipIndex = currentEntries.findIndex(
                        (e) => e === ip
                    );
                    const newEntry = {
                        ...entry,
                        value: ip
                    };
                    if (ipIndex > -1) {
                        updateArr.push(newEntry);
                    } else {
                        appendArr.push(newEntry);
                    }
                });
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

        let addedResponse = [];
        let updatedResponse = [];
        if (data.appended.length > 0) {
            addedResponse = data.appended.map(r => {
                return {
                    ...r,
                    action: 'added'
                };
            });
        }
        if (data.updated.length > 0) {
            updatedResponse = data.updated.map(r => {
                return {
                    ...r,
                    action: 'updated'
                };
            });
        }

        const response = { entries: addedResponse.concat(updatedResponse) };

        return context.sendJson(response, 'out');
    }
};

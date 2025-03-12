'use strict';

const { generateAuthorizationHeader } = require('../../signature');

module.exports = {
    receive: async (context) => {
        const { hostnameUrl, accessToken, clientSecret, clientToken } =
            context.auth;
        const { listId, value, description, ttl } = context.messages.in.content;

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

        const expirationDate = ttl
            ? new Date().getTime() + ttl * 1000
            : undefined;
        const ips = value.split(',');

        if (ips.length === 1) {
            const entryIndex = currentEntries.findIndex(
                (e) => e === entry.value
            );
            if (entryIndex > -1) {
            } else {
                appendArr.push({ value: ip, expirationDate, description });
            }
        } else {
            ips.forEach(ip => {
                ip = ip.trim();
                const ipIndex = currentEntries.findIndex(
                    (e) => e === ip
                );
                const newEntry = {
                    value: ip,
                    expirationDate,
                    description
                };
                if (ipIndex > -1) {
                    updateArr.push(newEntry);
                } else {
                    appendArr.push(newEntry);
                }
            });
        }

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

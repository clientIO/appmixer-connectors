'use strict';

const { generateAuthorizationHeader, parseIPs } = require('../../lib');

module.exports = {
    receive: async (context) => {
        const { hostnameUrl, accessToken, clientSecret, clientToken } =
            context.auth;
        const { listId, value, description, ttl, network } = context.messages.in.content;

        // GET list items to check whether to append or update
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

        const ips = parseIPs(value);

        ips.forEach(ip => {
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

        const body = {
            append: appendArr,
            update: updateArr
        };

        // POST new or updated list items
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

        // Activate list
        const activateBody = { action: 'ACTIVATE', network };

        const {
            url: ActivateUrl,
            method: ActivateMethod,
            headers: { Authorization: ActivateAuthorization }
        } = generateAuthorizationHeader({
            hostnameUrl,
            accessToken,
            clientToken,
            clientSecret,
            method: 'POST',
            path: `/client-list/v1/lists/${listId}/activations`,
            body: activateBody
        });

        await context.httpRequest({
            url: ActivateUrl,
            method: ActivateMethod,
            headers: { Authorization: ActivateAuthorization },
            data: activateBody
        });

        let addedResponse = [];
        let updatedResponse = [];
        if (data.appended.length > 0) {
            addedResponse = data.appended.map(r => {
                return {
                    action: 'added',
                    ...r
                };
            });
        }
        if (data.updated.length > 0) {
            updatedResponse = data.updated.map(r => {
                return {
                    action: 'updated',
                    ...r
                };
            });
        }

        const response = { entries: addedResponse.concat(updatedResponse) };

        return context.sendJson(response, 'out');
    }
};

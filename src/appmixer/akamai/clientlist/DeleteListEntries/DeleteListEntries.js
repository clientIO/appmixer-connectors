'use strict';

const { generateAuthorizationHeader } = require('../../signature');

module.exports = {
    receive: async (context) => {
        const { hostnameUrl, accessToken, clientSecret, clientToken } =
            context.auth;
        const { listId, deleteEntries } = context.messages.in.content;

        const body = {
            delete: deleteEntries.ADD
        };

        try {
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
        } catch (error) {
            if (error.name === 'AxiosError') {
                throw new context.CancelError(error.response.data);
            } else {
                throw new context.CancelError(error);
            }
        }
    }
};

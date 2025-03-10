'use strict';

const { generateAuthorizationHeader } = require('../../signature');

module.exports = {
    async receive(context) {
        const { hostnameUrl, accessToken, clientSecret, clientToken } =
            context.auth;
        const { listId, action, network, comments } =
            context.messages.in.content;

        const body = { action, network, comments };

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
        } catch (error) {
            if (error.name === 'AxiosError') {
                throw new context.CancelError(error.response.data);
            } else {
                throw new context.CancelError(error);
            }
        }

    }
};

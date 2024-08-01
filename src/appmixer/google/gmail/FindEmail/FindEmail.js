'use strict';
const emailCommons = require('../gmail-commons');

module.exports = {
    async receive(context) {
        const { query } = context.messages.in.content;
        const endpoint = '/users/me/messages';
        const options = {
            method: 'GET',
            params: {
                q: query,
                maxResults: 1
            }
        };
        // Fetch emails matching the query
        const { data } = await emailCommons.callEndpoint(context, endpoint, options);

        // Extract email details
        if (data.messages && data.messages.length > 0) {
            const messageEndpoint = `/users/me/messages/${data.messages[0].id}`;
            const messageDetails = await emailCommons.callEndpoint(context, messageEndpoint, {
                method: 'GET',
                params: {
                    format: 'full'
                }
            });
            const normalizedEmail = emailCommons.normalizeEmail(messageDetails.data);
            return context.sendJson(normalizedEmail, 'out');
        } else {
            return context.sendJson({}, 'notFound');
        }
    }
};

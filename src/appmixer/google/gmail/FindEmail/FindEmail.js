'use strict';
const commons = require('../gmail-commons');

module.exports = {
    async receive(context) {
        const { query } = context.messages.in.content;
        const endpoint = '/users/me/messages';
        const options = {
            params: {
                q: query,
                maxResults: 1
            }
        };
        // Fetch emails matching the query
        const { data } = await commons.fetchData(context, endpoint, options);

        // Extract email details
        let email = {};
        if (data.messages && data.messages.length > 0) {
            const messageEndpoint = `/users/me/messages/${data.messages[0].id}`;
            const messageDetails = await commons.fetchData(context, messageEndpoint, {
                params: {
                    format: 'full'
                }
            });
            email = {
                id: messageDetails.data.id,
                snippet: messageDetails.data.snippet,
                threadId: messageDetails.data.threadId,
                labelIds: messageDetails.data.labelIds
            };
        }
        return context.sendJson(email, 'out');
    }
};

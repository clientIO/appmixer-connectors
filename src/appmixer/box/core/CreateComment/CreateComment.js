'use strict';

module.exports = {

    async receive(context) {

        const { itemType = 'file', itemId, message, taggedMessage } = context.messages.in.content;

        // Validate required inputs
        if (!itemId) {
            throw new context.CancelError('Item ID is required.');
        }

        if (!message && !taggedMessage) {
            throw new context.CancelError('Either Message or Tagged Message is required.');
        }

        // Build request body
        const requestBody = {
            item: {
                type: itemType,
                id: itemId
            }
        };

        if (message) {
            requestBody.message = message;
        }

        if (taggedMessage) {
            requestBody.tagged_message = taggedMessage;
        }

        // https://developer.box.com/reference/post-comments/
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.box.com/2.0/comments',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json'
            },
            data: requestBody
        });

        return context.sendJson(data, 'out');
    }
};

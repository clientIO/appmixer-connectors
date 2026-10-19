'use strict';
const lib = require('../../lib');

module.exports = {
    async receive(context) {
        if (!context.messages.in.content.pageId) {
            throw new context.CancelError('Page ID is required!');
        }

        const pageId = context.messages.in.content.pageId;

        const response = await lib.callEndpoint(context, `/pages/${pageId}`
        );

        await context.sendJson(response.data, 'out');
    }
};

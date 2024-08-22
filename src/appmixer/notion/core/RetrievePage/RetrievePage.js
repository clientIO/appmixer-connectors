'use strict';
const lib = require('../../lib');

module.exports = {
    async receive(context) {
        const pageId = context.messages.in.content.pageId;

        const response = await lib.callEndpoint(context, `/pages/${pageId}`, {
            method: 'GET'
        });

        await context.sendJson(response.data, 'out');
    }
};

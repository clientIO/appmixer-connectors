'use strict';
const notionCommons = require('../../notion-commons');

module.exports = {
    async receive(context) {
        const pageId = context.messages.in.content.pageId;

        const response = await notionCommons.callEndpoint(context, `/pages/${pageId}`, {
            method: 'GET'
        });

        await context.sendJson(response.data, 'out');
    }
};

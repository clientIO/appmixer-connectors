'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { taskId, tagName } = context.messages.in.content;
        if (!taskId) {
            throw new context.CancelError('Task ID is required!');
        }
        if (!tagName) {
            throw new context.CancelError('Tag Name is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        await clickUpClient.request('POST', `/task/${taskId}/tag/${encodeURIComponent(tagName)}`, { data: {} });

        return context.sendJson({}, 'out');
    }
};

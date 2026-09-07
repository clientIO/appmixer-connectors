'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { spaceId, tagName } = context.messages.in.content;
        if (!spaceId) {
            throw new context.CancelError('Space ID is required!');
        }
        if (!tagName) {
            throw new context.CancelError('Tag Name is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        await clickUpClient.request('DELETE', `/space/${spaceId}/tag/${encodeURIComponent(tagName)}`);

        return context.sendJson({}, 'out');
    }
};

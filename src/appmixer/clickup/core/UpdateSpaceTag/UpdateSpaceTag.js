'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { spaceId, tagName, newName, foregroundColor, backgroundColor } = context.messages.in.content;
        if (!spaceId) {
            throw new context.CancelError('Space ID is required!');
        }
        if (!tagName) {
            throw new context.CancelError('Current Tag Name is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        await clickUpClient.request('PUT', `/space/${spaceId}/tag/${encodeURIComponent(tagName)}`, {
            data: {
                tag: {
                    name: newName || tagName,
                    tag_fg: foregroundColor,
                    tag_bg: backgroundColor
                }
            }
        });

        return context.sendJson({}, 'out');
    }
};

'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { spaceId, name, foregroundColor, backgroundColor } = context.messages.in.content;
        if (!spaceId) {
            throw new context.CancelError('Space ID is required!');
        }
        if (!name) {
            throw new context.CancelError('Tag Name is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        await clickUpClient.request('POST', `/space/${spaceId}/tag`, {
            data: {
                tag: {
                    name,
                    tag_fg: foregroundColor || '#000000',
                    tag_bg: backgroundColor || '#000000'
                }
            }
        });

        return context.sendJson({}, 'out');
    }
};

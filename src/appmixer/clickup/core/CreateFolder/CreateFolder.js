'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { spaceId, name } = context.messages.in.content;
        if (!spaceId) {
            throw new context.CancelError('Space ID is required!');
        }
        if (!name) {
            throw new context.CancelError('Name is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const folder = await clickUpClient.request('POST', `/space/${spaceId}/folder`, { data: { name } });

        return context.sendJson(folder, 'out');
    }
};

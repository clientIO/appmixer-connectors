'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { folderId, name } = context.messages.in.content;
        if (!folderId) {
            throw new context.CancelError('Folder ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        await clickUpClient.request('PUT', `/folder/${folderId}`, { data: { name } });

        return context.sendJson({}, 'out');
    }
};

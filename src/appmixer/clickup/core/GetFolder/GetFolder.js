'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { folderId } = context.messages.in.content;
        if (!folderId) {
            throw new context.CancelError('Folder ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const folder = await clickUpClient.request('GET', `/folder/${folderId}`);

        return context.sendJson(folder, 'out');
    }
};

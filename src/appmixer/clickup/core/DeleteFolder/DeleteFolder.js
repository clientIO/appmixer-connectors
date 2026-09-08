'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { folderId } = context.messages.in.content;
        if (!folderId) {
            throw new context.CancelError('Folder ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        await clickUpClient.request('DELETE', `/folder/${folderId}`);

        return context.sendJson({}, 'out');
    }
};

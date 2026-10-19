'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { listId } = context.messages.in.content;
        if (!listId) {
            throw new context.CancelError('List ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const list = await clickUpClient.request('GET', `/list/${listId}`);

        return context.sendJson(list, 'out');
    }
};

'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { checklistId } = context.messages.in.content;
        if (!checklistId) {
            throw new context.CancelError('Checklist ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        await clickUpClient.request('DELETE', `/checklist/${checklistId}`);

        return context.sendJson({}, 'out');
    }
};

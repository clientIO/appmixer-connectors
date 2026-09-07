'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { checklistId, checklistItemId } = context.messages.in.content;
        if (!checklistId) {
            throw new context.CancelError('Checklist ID is required!');
        }
        if (!checklistItemId) {
            throw new context.CancelError('Checklist Item ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        await clickUpClient.request('DELETE', `/checklist/${checklistId}/checklist_item/${checklistItemId}`);

        return context.sendJson({}, 'out');
    }
};

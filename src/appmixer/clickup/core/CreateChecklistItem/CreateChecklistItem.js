'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { checklistId, name, assignee } = context.messages.in.content;
        if (!checklistId) {
            throw new context.CancelError('Checklist ID is required!');
        }
        if (!name) {
            throw new context.CancelError('Name is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const body = { name };
        if (assignee) {
            body.assignee = assignee;
        }

        const response = await clickUpClient.request('POST', `/checklist/${checklistId}/checklist_item`, { data: body });

        return context.sendJson(response, 'out');
    }
};

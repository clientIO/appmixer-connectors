'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { listId, name, content, status, priority, dueDate, dueDateTime, unsetStatus } =
            context.messages.in.content;
        if (!listId) {
            throw new context.CancelError('List ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const listData = {};
        if (name !== undefined) listData.name = name;
        if (content !== undefined) listData.content = content;
        if (status !== undefined) listData.status = status;
        if (priority !== undefined) listData.priority = priority;
        if (dueDate) {
            listData.due_date = Date.parse(dueDate);
            listData.due_date_time = dueDateTime;
        }
        if (unsetStatus !== undefined) listData.unset_status = unsetStatus;

        await clickUpClient.request('PUT', `/list/${listId}`, { data: listData });

        return context.sendJson({}, 'out');
    }
};

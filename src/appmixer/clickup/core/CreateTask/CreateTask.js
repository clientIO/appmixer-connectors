'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const {
            listId,
            name,
            description,
            tags,
            status,
            priority,
            dueDate,
            dueDateTime,
            startDate,
            startDateTime,
            notifyAll,
            parent
        } = context.messages.in.content;

        const clickUpClient = new ClickUpClient(context);

        const taskData = {
            name,
            description,
            tags: tags?.split(',').map(item => item.trim()) ?? [],
            status,
            priority,
            due_date: dueDate && Date.parse(dueDate),
            due_date_time: dueDateTime,
            start_date: startDate && Date.parse(startDate),
            start_date_time: startDateTime,
            notify_all: notifyAll,
            parent
        };
        const createdTask = await clickUpClient.request('POST', `/list/${listId}/task`, { data: taskData });

        return context.sendJson(createdTask, 'out');
    }
};

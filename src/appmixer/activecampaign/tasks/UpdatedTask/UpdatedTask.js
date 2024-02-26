'use strict';
const moment = require('moment');
const ActiveCampaign = require('../../ActiveCampaign');
const Promise = require('bluebird');

module.exports = {

    async tick(context) {

        const { auth } = context;

        let since = new Date();
        let updated = new Set();

        const ac = new ActiveCampaign(auth.url, auth.apiKey);

        const tasks = await ac.getTasks({
            'orders[udate]': 'DESC'
        }, 100);

        const sinceToCompare = context.state.since || since;

        tasks.forEach(task => {
            const updatedAt = new Date(task.udate);
            if (updatedAt > sinceToCompare) {
                updated.add(task);
            }
        });

        if (updated.size) {
            await Promise.map(updated, task => {
                const fields = {
                    id: task.id,
                    relationship: task.owner.type,
                    contactId: task.owner.type === 'contact' ? task.relid : undefined,
                    dealId: task.owner.type === 'deal' ? task.relid : undefined,
                    title: task.title,
                    note: task.note,
                    taskType: task.dealTasktype,
                    assignee: task.assignee,
                    due: moment(task.duedate).toISOString(),
                    edate: moment(task.edate).toISOString()
                };

                return context.sendJson(fields, 'task');
            });
        }

        await context.saveState({ since });
    }
};

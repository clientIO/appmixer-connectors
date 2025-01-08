'use strict';
const moment = require('moment');
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async receive(context) {

        const { auth } = context;

        const {
            relationship,
            contactId,
            dealId,
            title,
            note,
            taskType,
            assignee,
            due,
            duration,
            durationUnits
        } = context.messages.in.content;

        const dueDate = moment(due);
        const eDate = dueDate.add(duration, durationUnits);

        const ac = new ActiveCampaign(auth.url, auth.apiKey);

        const body = {
            title,
            ownerType: relationship,
            relid: relationship === 'contact' ? contactId : dealId,
            note,
            dealTasktype: taskType,
            duedate: due,
            assignee,
            edate: eDate.toISOString()
        };

        const { data } = await ac.call('post', 'dealTasks', {
            dealTask: body
        });

        const { dealTask } = data;

        const taskResponseModified = {
            ...dealTask,
            contactId: dealTask.owner.type === 'contact' ? dealTask.relid : undefined,
            dealId: dealTask.owner.type === 'deal' ? dealTask.relid : undefined,
            due: new Date(dealTask.duedate).toISOString(),
            edate: new Date(dealTask.edate).toISOString()
        };

        delete taskResponseModified.duedate;
        delete taskResponseModified.links;

        return context.sendJson(taskResponseModified, 'newTask');
    }
};

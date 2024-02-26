'use strict';
const moment = require('moment');
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async receive(context) {

        const { auth } = context;

        const {
            taskId,
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

        const { data } = await ac.call('put', `dealTasks/${taskId}`, {
            dealTask: body
        });

        const { dealTask } = data;

        return context.sendJson({
            id: dealTask.id,
            relationship: dealTask.owner.type,
            contactId: dealTask.owner.type === 'contact' ? dealTask.relid : undefined,
            dealId: dealTask.owner.type === 'deal' ? dealTask.relid : undefined,
            title: dealTask.title,
            note: dealTask.note,
            taskType: dealTask.dealTasktype,
            assignee: dealTask.assignee,
            due: moment(dealTask.duedate).toISOString(),
            edate: moment(dealTask.edate).toISOString()
        }, 'task');
    }
};

'use strict';
const moment = require('moment');
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    start(context) {

        return this.registerWebhook(context);
    },

    async registerWebhook(context) {

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey);

        const { data } = await ac.registerWebhook('AppmixerNewTaskWebhook', context.getWebhookUrl(), [
            'deal_task_add'
        ]);

        return context.saveState({ webhookId: data.webhook.id });
    },

    stop(context) {

        return this.unregisterWebhook(context);
    },

    async unregisterWebhook(context) {

        const { webhookId } = await context.loadState();
        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey);
        return ac.unregisterWebhook(webhookId);
    },

    async receive(context) {

        const { auth } = context;
        if (context.messages.webhook) {
            const { data } = context.messages.webhook.content;
            const id = data['task[id]'];

            const ac = new ActiveCampaign(auth.url, auth.apiKey);

            const { data: getTask } = await ac.call('get', `dealTasks/${id}`);
            const { dealTask } = getTask;

            const task = {
                id,
                relationship: dealTask.owner.type,
                contactId: dealTask.owner.type === 'contact' ? dealTask.relid : undefined,
                dealId: dealTask.owner.type === 'deal' ? dealTask.relid : undefined,
                title: dealTask.title,
                note: dealTask.note,
                taskType: dealTask.dealTasktype,
                assignee: dealTask.assignee,
                due: moment(dealTask.duedate).toISOString(),
                edate: moment(dealTask.edate).toISOString()
            };

            await context.sendJson({ ...task }, 'task');
            return context.response();
        }
    }
};

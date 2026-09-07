'use strict';
const ActiveCampaign = require('../../ActiveCampaign');
const commons = require('../../activecampaign-commons');

module.exports = {

    async test(context) {

        const task = await commons.fetchLatestTask(context, 'cdate');
        if (!task) {
            throw new context.CancelError('No recent tasks to use as test data.');
        }
        return context.sendJson(task, 'task');
    },

    start(context) {

        return this.registerWebhook(context);
    },

    async registerWebhook(context) {

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

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
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);
        return ac.unregisterWebhook(webhookId);
    },

    async receive(context) {

        const { auth } = context;
        if (context.messages.webhook) {
            const { data } = context.messages.webhook.content;
            const id = data['task[id]'];

            const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

            const { data: getTask } = await ac.call('get', `dealTasks/${id}`);
            const { dealTask } = getTask;

            await context.sendJson(commons.reshapeTask(dealTask), 'task');
            return context.response();
        }
    }
};

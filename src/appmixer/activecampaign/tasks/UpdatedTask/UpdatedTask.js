'use strict';
const ActiveCampaign = require('../../ActiveCampaign');
const commons = require('../../activecampaign-commons');

module.exports = {

    async test(context) {

        const task = await commons.fetchLatestTask(context, 'udate');
        if (!task) {
            throw new context.CancelError('No recent tasks to use as test data.');
        }
        return context.sendJson(task, 'task');
    },

    async tick(context) {

        const { auth } = context;

        let since = new Date();
        let updated = new Set();

        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

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
            const promises = Array.from(updated).map(task => {
                return context.sendJson(commons.reshapeTask(task), 'task');
            });
            await Promise.all(promises);
        }

        await context.saveState({ since });
    }
};

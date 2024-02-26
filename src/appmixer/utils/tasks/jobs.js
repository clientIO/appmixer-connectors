'use strict';

module.exports = async context => {

    const config = require('./config')(context);
    const Webhook = require('./WebhookModel')(context);
    const Task = require('./TaskModel')(context);
    const utils = require('./utils')(context);

    await context.scheduleJob('due-tasks', config.dueTasksJob.schedule, async () => {

        try {
            const lock = await context.job.lock('people-tasks-due-tasks');

            try {
                const query = { 'status': 'pending', 'decisionBy': { '$lt': new Date() } };
                const tasks = await Task.find(query);

                const res = await context.utils.P.mapArray(tasks, function(task) {
                    task.setStatus(Task.STATUS_DUE);
                    let webhooksTriggered;
                    return utils.triggerWebhooks(task)
                        .then(result => {
                            webhooksTriggered = result;
                            // after all webhooks were triggered successfully save
                            // new status
                            return task.save();
                        })
                        .then(() => {
                            return webhooksTriggered;
                        });
                }, { concurrency: config.triggerWebhooksConcurrencyLimit });

                const result = {
                    tasks: tasks.length,
                    triggeredWebhooks: res.flat().filter(item => item).length,
                    errors: res.flat().filter(item => !item).length
                };

                context.log('info', `Checking due tasks finished, ${result.tasks} due tasks processed, ${result.triggeredWebhooks} ` +
                    `webhooks triggered, ${result.errors} webhooks failed.`);
            } finally {
                lock.unlock();
            }
        } catch (err) {
            if (err.message !== 'locked') {
                context.log('error', 'Error checking due tasks', context.utils.Error.stringify(err));
            }
        }
    });

    await context.scheduleJob('resubmit-failed-webhooks', config.resubmitFailedWebhooksJob.schedule, async () => {

        try {
            const lock = await context.job.lock('people-tasks-failed-webhooks');

            try {
                const webhooks = await Webhook.find({ status: Webhook.STATUS_FAIL });
                const res = await context.utils.P.mapArray(webhooks, function(webhook) {
                    return utils.triggerWebhook(webhook);
                }, { concurrency: config.triggerWebhooksConcurrencyLimit });

                const result = {
                    webhooks: webhooks.length,
                    success: res.flat().filter(item => item).length,
                    errors: res.flat().filter(item => !item).length
                };

                context.log('info', `Resubmit failed webhooks finished, ${result.success} webhooks triggered, `
                    + `${result.errors} failed.`);
            } finally {
                lock.unlock();
            }
        } catch (err) {
            if (err.message !== 'locked') {
                context.log('error', 'Error resubmitting failed webhooks', context.utils.Error.stringify(err));
            }
        }
    });
};

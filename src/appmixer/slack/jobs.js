'use strict';

// Slack version: uses SlackTaskModel and SlackWebhookModel, expects Slack user IDs.
module.exports = async context => {

    const config = require('./config')(context);
    const Task = require('./SlackTaskModel')(context);
    const utils = require('./taskUtils')(context);
    context.log('info', '[slack-job-due-tasks] CONFIG', { config });

    await context.scheduleJob('slack-due-tasks', config.dueTasksJob.schedule, async () => {
        try {
            const lock = await context.job.lock('slack-tasks-due-tasks');
            try {
                // Delete all old tasks older than 60 days
                const deleteBefore = new Date();
                deleteBefore.setDate(deleteBefore.getDate() - 60);
                context.log('info', `[slack-job-due-tasks] Deleting old tasks older than ${deleteBefore.toISOString()}`);

                const filter = { 'created': { '$lt': deleteBefore } };
                const resultDel = await context.db.collection(Task.collection).deleteMany(filter);
                const deletedCount = resultDel?.deletedCount || 0;
                context.log('info', `[slack-job-due-tasks] Old tasks deletion finished. Deleted: ${deletedCount}`);

                const query = { 'status': 'pending', 'decisionBy': { '$lt': new Date() } };
                const tasks = await Task.find(query);
                const res = await context.utils.P.mapArray(tasks, async function(task) {
                    task.setStatus(Task.STATUS_DUE);
                    try {
                        // On failure, triggerWebhook already persisted (or removed) the task.
                        const { ok } = await utils.triggerWebhook(task);
                        if (ok) {
                            await task.save();
                        }
                        return ok;
                    } catch (err) {
                        task.setStatus(Task.STATUS_ERROR);
                        try {
                            await task.save();
                        } catch (saveErr) {
                            context.log(
                                'error',
                                '[slack-job-due-tasks] failed to save task after trigger error',
                                { err: saveErr, taskId: task.getId ? task.getId() : task.taskId }
                            );
                        }
                        context.log(
                            'error',
                            '[slack-job-due-tasks] triggerWebhook failed; task marked as error',
                            { err, taskId: task.getId ? task.getId() : task.taskId }
                        );
                        return false;
                    }
                }, { concurrency: config.triggerWebhooksConcurrencyLimit });
                const result = {
                    tasks: tasks.length,
                    triggeredWebhooks: res.flat().filter(item => item).length,
                    errors: res.flat().filter(item => !item).length
                };
                context.log('trace', `[slack-job-due-tasks] ${JSON.stringify(result)}`);
            } finally {
                await lock?.unlock();
            }
        } catch (err) {
            if (err.message !== 'locked') {
                context.log('error', `[slack-job-due-tasks-error] ${context.utils.Error.stringify(err)}`);
            }
        }
    });

    await context.scheduleJob('slack-resubmit-failed-webhooks', config.resubmitFailedWebhooksJob.schedule, async () => {
        try {
            const lock = await context.job.lock('slack-tasks-failed-webhooks');
            try {
                // Only tasks whose backoff has elapsed. Tasks failed before backoff was introduced have no nextAttemptAt.
                const tasksToRetry = await Task.find({
                    status: Task.STATUS_ERROR,
                    $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: new Date() } }]
                });
                const res = await context.utils.P.mapArray(tasksToRetry, async function(taskToRetry) {
                    // Deliver again the status that failed. triggerWebhook persists the failure itself:
                    // the task is removed when the target is gone (404/410), otherwise it stays in error
                    // and is retried later.
                    taskToRetry.setStatus(taskToRetry.failedStatus || Task.STATUS_PENDING);
                    try {
                        const { ok, removed } = await utils.triggerWebhook(taskToRetry);
                        if (ok) {
                            await taskToRetry.save();
                            return 'success';
                        }
                        return removed ? 'removed' : 'failed';
                    } catch (err) {
                        // revert status and persist
                        try {
                            taskToRetry.setStatus(Task.STATUS_ERROR);
                            await taskToRetry.save();
                        } catch (err2) {
                            // log but continue
                            context.log('error', '[slack-resubmit-failed-webhooks] failed to save task after trigger error', context.utils.Error.stringify(err2));
                        }
                        return 'failed';
                    }
                }, { concurrency: config.triggerWebhooksConcurrencyLimit });
                const result = {
                    webhooks: tasksToRetry.length,
                    success: res.filter(item => item === 'success').length,
                    errors: res.filter(item => item === 'failed').length,
                    removed: res.filter(item => item === 'removed').length
                };
                context.log('info', `Resubmit failed webhooks finished, ${result.success} webhooks triggered, ${result.errors} failed, ${result.removed} removed.`, result);
            } finally {
                await lock?.unlock();
            }
        } catch (err) {
            if (err.message !== 'locked') {
                context.log('error', 'Error resubmitting failed webhooks', context.utils.Error.stringify(err));
            }
        }
    });
};

'use strict';

const check = require('check-types');

// The flow or the component behind the webhook URL no longer exists. Retrying will never succeed.
const PERMANENT_HTTP_STATUSES = [404, 410];

// Bookkeeping properties of the task that are not part of the webhook payload.
const INTERNAL_PROPERTIES = ['webhookAttempts', 'nextAttemptAt', 'failedStatus'];

module.exports = context => {

    const config = require('./config')(context);
    const Task = require('./SlackTaskModel')(context);

    return {

        /**
         * Trigger a single webhook.
         * On success, the caller is responsible for saving the task.
         * On failure, the task is persisted here: deleted when the failure is permanent (flow or component
         * no longer exists), otherwise marked as error and scheduled for the next attempt with an exponential
         * backoff. A task that keeps failing (e.g. its flow is stopped) is never dropped here, so the decision
         * is delivered once the flow runs again. The cleanup of old tasks in the due tasks job removes it.
         * @param {Task} [task]
         * @return {Promise<{ ok: boolean, permanent?: boolean, removed?: boolean, httpStatus?: number }>}
         */
        triggerWebhook: async function(task) {

            check.assert.instance(task, Task, 'task must be an instance of Task');

            // Status that should be delivered. For a resubmitted task, it is the one that failed to deliver.
            const status = task.getStatus();
            const data = task.toJson();
            INTERNAL_PROPERTIES.forEach(prop => delete data[prop]);

            try {
                await context.httpRequest({
                    method: 'POST',
                    url: task.getWebhookUrl(),
                    data
                });
                task.setWebhookAttempts(0);
                task.setNextAttemptAt(null);
                task.setFailedStatus(null);
                return { ok: true };
            } catch (err) {
                const httpStatus = err.response?.status;
                const permanent = PERMANENT_HTTP_STATUSES.includes(httpStatus);
                const attempts = (task.getWebhookAttempts() || 0) + 1;
                const logData = { taskId: task.taskId, httpStatus, attempts };

                if (permanent) {
                    await context.db.collection(Task.collection).deleteOne({ [Task.idProperty]: task.taskId });
                    context.log(
                        'warn',
                        '[slack-trigger-webhook-gone] Webhook target no longer exists, task removed.',
                        { ...logData, err: context.utils.Error.stringify(err) }
                    );
                    return { ok: false, permanent: true, removed: true, httpStatus };
                }

                const { backoffBaseMs, backoffMaxMs } = config.resubmitFailedWebhooksJob;
                const delay = Math.min(backoffBaseMs * Math.pow(2, attempts - 1), backoffMaxMs);
                task.setFailedStatus(status);
                task.setWebhookAttempts(attempts);
                task.setNextAttemptAt(new Date(Date.now() + delay));
                task.setStatus(Task.STATUS_ERROR);
                await task.save();
                context.log('error', `[slack-trigger-webhook-error] ${context.utils.Error.stringify(err)}`, logData);
                return { ok: false, permanent: false, removed: false, httpStatus };
            }
        }
    };
};

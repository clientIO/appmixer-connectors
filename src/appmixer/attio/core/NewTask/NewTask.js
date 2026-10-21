'use strict';

const lib = require('../../lib');

const EVENT_TYPE = 'task.created';

function toOutput(task, actor) {
    return { ...task, actor };
}

module.exports = {

    async start(context) {

        return lib.startWebhookTrigger(context, EVENT_TYPE, null);
    },

    async stop(context) {

        return lib.stopWebhookTrigger(context);
    },

    async receive(context) {

        if (context.messages.webhook) {
            const events = await lib.getWebhookEvents(context, EVENT_TYPE);
            for (const event of events) {
                const { task_id: taskId } = event.id || {};
                let task;
                try {
                    const { data } = await lib.apiRequest(context, { path: '/v2/tasks/' + encodeURIComponent(taskId) });
                    task = lib.mapTask(data);
                } catch (err) {
                    // The task was deleted before we could read it.
                    if (lib.isNotFound(err)) continue;
                    throw err;
                }
                await context.sendJson(toOutput(task, lib.actorOfEvent(event)), 'out');
            }
            return context.response();
        }
    },

    async test(context) {

        const { data } = await lib.apiRequest(context, { path: '/v2/tasks', params: { limit: 1, sort: 'created_at:desc' } });
        const task = (data || [])[0];
        if (!task) {
            throw new context.CancelError('There are no tasks yet. Create a task in Attio to get test data.');
        }
        const mapped = lib.mapTask(task);
        return context.sendJson(toOutput(mapped, { type: mapped.createdByActorType, id: mapped.createdByActorId }), 'out');
    }
};

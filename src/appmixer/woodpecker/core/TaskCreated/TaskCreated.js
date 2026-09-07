'use strict';

const lib = require('../../lib');

const EVENT = 'task_created';

module.exports = {

    async start(context) {
        const companyId = context.profileInfo?.companyId;
        if (!companyId) {
            throw new context.CancelError('Woodpecker account is missing a company id — reconnect the account.');
        }
        return context.addListener(`${EVENT}:${companyId}`, {
            apiKey: context.auth.apiKey,
            companyId,
            event: EVENT
        });
    },

    async stop(context) {
        const companyId = context.profileInfo?.companyId;
        return context.removeListener(`${EVENT}:${companyId}`);
    },

    async receive(context) {
        if (context.messages.webhook) {
            await context.sendJson(context.messages.webhook.content.data, 'out');
        }
    },

    // Flow Test Mode: emit one realistic event payload without registering the webhook.
    async test(context) {
        // Prefer a real manual task id; fall back to a synthetic one on empty accounts.
        let taskId = 7788;
        try {
            const { data } = await context.httpRequest({
                method: 'GET',
                url: `${lib.API_BASE_URL}/v2/manual_tasks`,
                headers: lib.getHeaders(context)
            });
            const tasks = Array.isArray(data) ? data : (data.tasks || data.manual_tasks || []);
            if (Array.isArray(tasks) && tasks[0] && tasks[0].id) {
                taskId = tasks[0].id;
            }
        } catch (err) {
            // keep the synthetic fallback
        }
        const example = await lib.fetchLatestExample(context, EVENT, { 'task_id': taskId });
        if (!example) {
            throw new context.CancelError('No prospects available to build a test example.');
        }
        return context.sendJson(example, 'out');
    }
};

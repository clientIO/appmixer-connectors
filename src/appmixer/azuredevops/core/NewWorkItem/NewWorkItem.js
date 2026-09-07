'use strict';

const api = require('../../api');
const lib = require('../../lib');

module.exports = {

    // Flow Test Mode: fetch the newest work item read-only and wrap it in the
    // workitem.created service-hook payload receive() forwards (resource IS the
    // work item, so receive() reads resource.fields).
    async test(context) {

        const workItem = await lib.fetchLatestWorkItem(context, { orderField: 'System.CreatedDate' });
        if (!workItem) {
            throw new Error('No recent work items to use as test data.');
        }
        return context.sendJson({ eventType: 'workitem.created', resource: workItem }, 'out');
    },

    async start(context) {

        const { organization, projectId } = context.properties;
        const webhookUrl = context.getWebhookUrl();

        const subscription = await api.CreateSubscription.execute(context, {
            organization,
            projectId,
            eventType: 'workitem.created',
            webhookUrl
        });

        return context.saveState({ subscriptionId: subscription.id });
    },

    async receive(context) {

        if (context.messages.webhook) {
            const payload = context.messages.webhook.content.data;
            const { workItemType } = context.properties;

            // Apply optional work item type filter
            if (workItemType && payload.resource && payload.resource.fields) {
                const itemType = payload.resource.fields['System.WorkItemType'];
                if (itemType && itemType.toLowerCase() !== workItemType.toLowerCase()) {
                    return context.response();
                }
            }

            await context.sendJson(payload, 'out');
            return context.response();
        }
    },

    async stop(context) {

        const state = await context.loadState();
        const { subscriptionId } = state;

        if (subscriptionId) {
            const { organization } = context.properties;
            try {
                await api.DeleteSubscription.execute(context, { organization, subscriptionId });
            } catch (err) {
                // Log but don't throw — allow flow to stop cleanly even if webhook cleanup fails
                await context.log({ step: 'DeleteSubscription failed', subscriptionId, err: err.message });
            }
        }
    }
};

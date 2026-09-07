'use strict';

const api = require('../../api');
const lib = require('../../lib');

module.exports = {

    // Flow Test Mode: fetch the newest work item read-only and wrap it in the
    // workitem.updated service-hook payload receive() forwards. The updated event
    // nests the work item under resource.revision (receive() reads
    // resource.revision.fields); resource.fields holds the changed-field diff, which
    // isn't reproducible read-only, so it's left empty.
    async test(context) {

        const workItem = await lib.fetchLatestWorkItem(context, { orderField: 'System.ChangedDate' });
        if (!workItem) {
            throw new Error('No recent work items to use as test data.');
        }
        const resource = {
            id: workItem.id,
            workItemId: workItem.id,
            rev: workItem.rev,
            revision: workItem,
            fields: {},
            url: workItem.url
        };
        return context.sendJson({ eventType: 'workitem.updated', resource }, 'out');
    },

    async start(context) {

        const { organization, projectId } = context.properties;
        const webhookUrl = context.getWebhookUrl();

        const subscription = await api.CreateSubscription.execute(context, {
            organization,
            projectId,
            eventType: 'workitem.updated',
            webhookUrl
        });

        return context.saveState({ subscriptionId: subscription.id });
    },

    async receive(context) {

        if (context.messages.webhook) {
            const payload = context.messages.webhook.content.data;
            const { workItemType } = context.properties;

            // Apply optional work item type filter using the revised fields
            if (workItemType && payload.resource && payload.resource.revision && payload.resource.revision.fields) {
                const itemType = payload.resource.revision.fields['System.WorkItemType'];
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

'use strict';
const commons = require('../../jira-commons');
const moment = require('moment');

module.exports = {

    async start(context) {

        const startTimestamp = moment().valueOf();
        await context.stateSet('startTimestamp', startTimestamp);
    },

    async receive(context) {

        if (context.properties.generateInspector) {
            return commons.generateWebhookInspector(context, 'issue');
        }

        const { startTimestamp } = await context.loadState();

        if (context.messages.webhook) {
            if (!startTimestamp || context.messages.webhook.content.data.timestamp > startTimestamp) {
                const option = {
                    port: 'issue',
                    key: 'issue',
                    eventType: commons.EventType.issueUpdated
                };
                await commons.executeWebhookRequest(context, option);
            }
        }

        if (!startTimestamp) {
            await context.stateSet('startTimestamp', moment().valueOf());
        }

        return context.response();
    },

    async test(context) {

        // No webhook registration: fetch the most recently updated issue and reshape
        // it into the same payload receive() emits (the issue object + webhookEvent).
        const issue = await commons.fetchLatestIssue(context, { orderBy: 'updated' });
        if (!issue) {
            throw new Error('No recently updated issues to use as test data.');
        }
        return context.sendJson(commons.toWebhookShape(issue, commons.EventType.issueUpdated), 'issue');
    }
};

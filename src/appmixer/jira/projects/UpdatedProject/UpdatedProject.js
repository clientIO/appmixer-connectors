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
            return commons.generateWebhookInspector(context, 'project');
        }

        const { startTimestamp } = await context.loadState();

        if (context.messages.webhook) {
            if (!startTimestamp || context.messages.webhook.content.data.timestamp > startTimestamp) {
                const option = {
                    port: 'project',
                    key: 'project',
                    eventType: commons.EventType.projectUpdated
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

        // No webhook registration: fetch one project and reshape it into the same
        // payload receive() emits (the project object + webhookEvent).
        const project = await commons.fetchLatestProject(context);
        if (!project) {
            throw new Error('No projects to use as test data.');
        }
        return context.sendJson(commons.toWebhookShape(project, commons.EventType.projectUpdated), 'project');
    }
};

'use strict;';
const { ApifyClient } = require('apify-client');

module.exports = {

    async receive(context) {

        let auth = context.auth;
        const message = context.messages.in.content;

        const url = message.url;
        const pageFunction = message.pageFunction;
        const wait = typeof message.wait === 'undefined' ? 30 : message.wait;

        // Get credentials at https://my.apify.com/account#/integrations
        const client = new ApifyClient({
            token: auth.apiToken
        });

        const input = {
            runMode: 'PRODUCTION',
            startUrls: [{ url }],
            pageFunction,
            waitUntil: [
                'networkidle2'
            ],
            injectJQuery: true,
            pageLoadTimeoutSecs: wait
        };

        const run = await client.actor('apify/web-scraper').call(input);
        const {
            id,
            actId,
            actorTaskId,
            startedAt,
            finishedAt,
            status
        } = run;

        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        const result = items[0];

        const {
            errorMessages
        } = result['#debug'];
        delete result['#debug'];
        delete result['#error'];
        const errorMessage = Array.isArray(errorMessages) ? errorMessages[0] : '';
        if (errorMessage) {
            throw new Error(errorMessage);
        }

        const response = {
            id,
            actId,
            actorTaskId,
            status,
            result,
            startedAt,
            finishedAt
        };

        return context.sendJson(response, 'done');
    }
};

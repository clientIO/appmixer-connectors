'use strict';

const { WebClient } = require('@slack/web-api');

module.exports = {

    async receive(context) {

        const { file } = context.messages.in.content;

        // Initialize Slack Web API client
        const web = new WebClient(context.auth.accessToken);
        const result = await web.files.info({
            file
        });

        await context.log({ step: 'Slack response', result });

        if (!result.ok) {
            throw new Error(result.error);
        }

        await context.sendJson(result.file, 'out');
    }
};

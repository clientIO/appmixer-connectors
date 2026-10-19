'use strict';

const { WebClient } = require('@slack/web-api');

module.exports = {

    async receive(context) {

        const { file } = context.messages.in.content;

        if (!file) {
            throw new context.CancelError('File is required!');
        }

        // Initialize Slack Web API client
        const web = new WebClient(context.auth.accessToken);
        const result = await web.files.delete({
            file
        });

        if (!result.ok) {
            throw new Error(result.error);
        }

        return context.sendJson({}, 'out');
    }
};

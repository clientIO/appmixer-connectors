'use strict';

const { WebClient } = require('@slack/web-api');
const commons = require('../../slack-commons');

module.exports = {

    async receive(context) {

        const { userIds, fileId, filename, altTxt, snippetType, initialComment } = context.messages.in.content;
        let client = commons.getSlackAPIClient(context.auth.accessToken);
        if (userIds.length > 8) {
            throw new context.CancelError('You can send a message to a maximum of 8 users at once');
        }
        let ids = userIds?.join(',');

        // First, open a conversation with the user(s). It will return the channel ID.
        const channel = await client.openConversation(ids);
        if (!channel || !channel.id) {
            const errorDetails = JSON.stringify({ channel, userIds });
            throw new context.CancelError('Could not open a conversation with a user. Details: ' + errorDetails);
        }

        // Get Appmixer file info
        const fileInfo = await context.getFileInfo(fileId);
        const fileStream = await context.getFileReadStream(fileId);

        // Initialize Slack Web API client
        const web = new WebClient(context.auth.accessToken);
        const result = await web.filesUploadV2({
            channel_id: channel,
            file: fileStream,
            filename: filename || fileInfo.filename,
            initial_comment: initialComment,
            alt_text: altTxt,
            snippet_type: snippetType
        });

        if (!result.ok) {
            throw new Error(result.error);
        }

        if (!result.files[0].ok) {
            throw new Error(result.files[0].error);
        }

        const file = result.files[0].files[0];

        await context.sendJson(file, 'out');
    }
};

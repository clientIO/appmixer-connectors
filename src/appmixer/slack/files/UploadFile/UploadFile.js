'use strict';

const { WebClient } = require('@slack/web-api');

module.exports = {

    async receive(context) {

        const { channel, fileId, filename, altTxt, snippetType, initialComment } = context.messages.in.content;

        // Get Appmixer file info
        const fileInfo = await context.getFileInfo(fileId);
        const fileStream = await context.getFileReadStream(fileId);

        // Initialize Slack Web API client
        const web = new WebClient(context.auth.accessToken);
        const result = await web.filesUploadV2({
            channels: channel,
            file: fileStream,
            filename: filename || fileInfo.filename,
            initial_comment: initialComment,
            alt_text: altTxt,
            snippet_type: snippetType
        });

        await context.log({ step: 'Slack response', result });

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

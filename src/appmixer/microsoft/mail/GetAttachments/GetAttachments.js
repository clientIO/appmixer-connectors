'use strict';

const { makeRequest } = require('../commons');

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.outputType);
        }

        const { messageId, outputType } = context.messages.in.content;

        const url = `/me/messages/${messageId}/attachments`;
        const attachmentsResponse = await makeRequest(context, { path: url, method: 'GET' });

        const value = attachmentsResponse.data.value;

        if (outputType === 'attachments') {
            return context.sendJson(value, 'out');
        } else {
            // one attachment at a time.
            for (let i = 0; i < value.length; i++) {
                const attachment = value[i];
                await context.sendJson(attachment, 'out');
            }
        }
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'attachment') {
            return context.sendJson([
                { label: 'Attachment ID', value: 'id' },
                { label: 'Is Inline', value: 'isInline' },
                { label: 'Name', value: 'name' },
                { label: 'Size', value: 'size' },
                { label: 'Content Type', value: 'contentType' },
                { label: 'Content Location', value: 'contentLocation' },
                { label: 'Content Bytes', value: 'contentBytes' },
                { label: 'Content ID', value: 'contentId' },
                { label: 'Last Modified Date Time', value: 'lastModifiedDateTime' }
            ], 'out');
        } else if (outputType === 'attachments') {
            return context.sendJson([{ label: 'Attachments', value: 'attachments' }], 'out');
        }
    }
};

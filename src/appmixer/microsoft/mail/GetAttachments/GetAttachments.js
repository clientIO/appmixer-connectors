'use strict';

const { makeRequest } = require('../commons');

// Metadata-only fields of the base attachment resource. Selecting only these
// guarantees the binary `contentBytes` (a fileAttachment-specific property) is
// never returned, which avoids Appmixer's max message size exception on emails
// with large attachments. Use the DownloadAttachment component to get content.
const METADATA_FIELDS = ['id', 'name', 'contentType', 'size', 'isInline', 'lastModifiedDateTime'];

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.outputType);
        }

        const { messageId, outputType } = context.messages.in.content;

        if (!messageId) {
            throw new context.CancelError('Message ID is required!');
        }

        const url = `/me/messages/${messageId}/attachments`;
        const attachmentsResponse = await makeRequest(context, {
            path: url,
            method: 'GET',
            params: { '$select': METADATA_FIELDS.join(',') }
        });

        const value = attachmentsResponse.data.value;

        if (outputType === 'attachments') {
            return context.sendJson(value, 'out');
        } else {
            // one attachment at a time.
            for (const attachment of value) {
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
                { label: 'Last Modified Date Time', value: 'lastModifiedDateTime' }
            ], 'out');
        } else if (outputType === 'attachments') {
            return context.sendJson([{ label: 'Attachments', value: 'attachments' }], 'out');
        }
    }
};

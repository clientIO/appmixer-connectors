'use strict';
const emailCommons = require('../gmail-commons');

module.exports = {
    async receive(context) {
        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { outputType, query } = context.messages.in.content;
        const maxLimit = 500; // Set a fixed maximum limit of 500

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        // Fetch up to 500 emails in a single call
        const result = await emailCommons.callEndpoint(context, '/users/me/messages', {
            params: {
                q: query,
                maxResults: maxLimit
            },
            headers: { 'Content-Type': 'application/json' }
        });

        const emails = (result.data.messages || []).map(message => ({
            ID: message.id,
            ThreadID: message.threadId
        }));

        if (emails.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        if (outputType === 'first') {
            return context.sendJson({ Email: emails[0], index: 0, count: emails.length }, 'out');
        }

        if (outputType === 'array') {
            return context.sendJson({ Emails: emails, count: emails.length }, 'out');
        }

        if (outputType === 'object') {
            for (let index = 0; index < emails.length; index++) {
                const Email = emails[index];
                await context.sendJson({ Email, index, count: emails.length }, 'out');
            }
        }

        if (outputType === 'file') {
            const headers = Object.keys(emails[0]);
            const csvRows = [headers.join(',')];

            for (const email of emails) {
                const row = Object.values(email).join(',');
                csvRows.push(row);
            }

            const csvString = csvRows.join('\n');
            const buffer = Buffer.from(csvString, 'utf8');
            const filename = `gmail-findemails-${context.componentId}.csv`;
            const savedFile = await context.saveFileStream(filename, buffer);
            await context.sendJson({ fileId: savedFile.fileId, count: emails.length }, 'out');
        }
    },

    getOutputPortOptions(context, outputType) {
        if (outputType === 'first' || outputType === 'object') {
            const options = [
                { label: 'Current Email Index', value: 'index', schema: { type: 'integer' } },
                { label: 'Emails Count', value: 'count', schema: { type: 'integer' } },
                {
                    label: 'Email',
                    value: 'Email',
                    schema: this.emailSchema
                }
            ];
            return context.sendJson(options, 'out');
        } else if (outputType === 'array') {
            const options = [
                { label: 'Emails Count', value: 'count', schema: { type: 'integer' } },
                {
                    label: 'Emails',
                    value: 'Emails',
                    schema: {
                        type: 'array',
                        items: this.emailSchema
                    }
                }
            ];
            return context.sendJson(options, 'out');
        } else { // file
            return context.sendJson([
                { label: 'File ID', value: 'fileId' },
                { label: 'Emails Count', value: 'count', schema: { type: 'integer' } }
            ], 'out');
        }
    },

    emailSchema: {
        'type': 'object',
        'properties': {
            'ID': {
                'type': 'string',
                'description': 'Email Message ID'
            },
            'ThreadID': {
                'type': 'string',
                'description': 'Thread ID'
            }
        }
    }
};

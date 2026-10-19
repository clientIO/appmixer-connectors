'use strict';
const ClickUpClient = require('../../ClickUpClient');
const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { commentsOn, resourceId, outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        if (!commentsOn) {
            throw new context.CancelError('Comments On is required!');
        }
        if (!resourceId) {
            throw new context.CancelError('Resource ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const response = await clickUpClient.request('GET', `/${commentsOn}/${resourceId}/comment`);
        const comments = response.comments || [];

        if (!comments.length) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({
            context,
            outputPortName: 'out',
            outputType,
            records: comments
        });
    },

    getOutputPortOptions(context, outputType) {

        const itemSchema = {
            id: { type: 'string', title: 'Comment ID' },
            comment_text: { type: 'string', title: 'Comment Text' },
            'user.id': { type: 'number', title: 'User ID' },
            'user.username': { type: 'string', title: 'Username' },
            'user.email': { type: 'string', title: 'Email' },
            resolved: { type: 'boolean', title: 'Resolved' },
            date: { type: 'string', title: 'Date' }
        };

        return lib.getOutputPortOptions(context, outputType, itemSchema, {
            label: 'Comments',
            value: 'result'
        });
    }
};

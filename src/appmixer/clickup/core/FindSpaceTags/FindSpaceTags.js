'use strict';
const ClickUpClient = require('../../ClickUpClient');
const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { spaceId, outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        if (!spaceId) {
            throw new context.CancelError('Space ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);
        const response = await clickUpClient.request('GET', `/space/${spaceId}/tag`);
        const tags = response.tags || [];

        if (!tags.length) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({
            context,
            outputPortName: 'out',
            outputType,
            records: tags
        });
    },

    getOutputPortOptions(context, outputType) {

        const itemSchema = {
            name: { type: 'string', title: 'Name' },
            tag_fg: { type: 'string', title: 'Foreground Color' },
            tag_bg: { type: 'string', title: 'Background Color' }
        };

        return lib.getOutputPortOptions(context, outputType, itemSchema, {
            label: 'Tags',
            value: 'result'
        });
    }
};

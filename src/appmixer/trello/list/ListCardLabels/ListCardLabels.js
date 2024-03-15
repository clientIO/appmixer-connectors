'use strict';
const commons = require('../../trello-commons');

/**
 * Component for fetching list of labels of card
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { boardListCardId, outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const { data } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            url: `https://api.trello.com/1/cards/${boardListCardId}?${commons.getAuthQueryParams(context)}`
        });

        return commons.sendArrayOutput({
            context,
            outputPortName: 'labels',
            outputType,
            records: data.labels
        });
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson(
                [
                    { label: 'id', value: 'id' },
                    { label: 'idBoard', value: 'idBoard' },
                    { label: 'name', value: 'name' },
                    { label: 'color', value: 'color' }
                ],
                'labels'
            );
        } else if (outputType === 'items') {
            return context.sendJson(
                [
                    {
                        label: 'Labels',
                        value: 'items',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    'id': { title: 'id', type: 'string' },
                                    'idBoard': { title: 'idBoard', type: 'string' },
                                    'name': { title: 'name', type: 'string' },
                                    'color': { title: 'color', type: 'string' }
                                }
                            }
                        }
                    }
                ],
                'labels'
            );
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'labels');
        }
    }
};

'use strict';
const commons = require('../../trello-commons');
const Promise = require('bluebird');

/**
 * Component for fetching list of labels of card
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { boardListCardId, outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        let client = commons.getTrelloAPI(context.auth.consumerKey, context.auth.accessToken);
        let getLabels = Promise.promisify(client.get, { context: client });

        return getLabels(
            `/1/cards/${boardListCardId}`
        ).then(res => {
            return commons.sendArrayOutput({
                context,
                outputPortName: 'labels',
                outputType,
                records: res['labels']
            });
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

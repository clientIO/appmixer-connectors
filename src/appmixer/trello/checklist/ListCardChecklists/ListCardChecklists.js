'use strict';
const commons = require('../../trello-commons');

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { boardListCardId, outputType, isSource } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        if (isSource) {
            if (!boardListCardId) {
                return context.sendJson({ boardListCardId: [] }, 'out');
            }
        }

        const { data } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            url: `https://api.trello.com/1/cards/${boardListCardId}/checklists?${commons.getAuthQueryParams(context)}`
        });


        return commons.sendArrayOutput({
            context,
            outputPortName: 'out',
            outputType,
            records: data
        });
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'object') {
            return context.sendJson(
                [
                    { label: 'ID', value: 'id' },
                    { label: 'Board ID', value: 'idBoard' },
                    { label: 'Name', value: 'name' }
                ],
                'out'
            );
        } else if (outputType === 'array') {
            return context.sendJson(
                [
                    {
                        label: 'Checklists',
                        value: 'array',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    'id': { title: 'ID', type: 'string' },
                                    'idBoard': { title: 'Board ID', type: 'string' },
                                    'name': { title: 'Name', type: 'string' }
                                }
                            }
                        }
                    }
                ],
                'out'
            );
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};

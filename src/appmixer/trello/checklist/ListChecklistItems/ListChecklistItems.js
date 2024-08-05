'use strict';
const commons = require('../../trello-commons');

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { checklistId, boardListCardId, outputType, isSource } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        if (isSource) {
            if (!checklistId || !boardListCardId) {
                return context.sendJson({ checklistId: [] }, 'out');
            }
        }

        const { data } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            url: `https://api.trello.com/1/checklists/${checklistId}/checkitems?${commons.getAuthQueryParams(context)}`
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
                    { label: 'Checklist ID', value: 'idChecklist', schema: { type: 'string' } },
                    { label: 'Checklist Item ID', value: 'id', schema: { type: 'string' } },
                    { label: 'Position', value: 'pos', schema: { type: 'string' } },
                    { label: 'State', value: 'state', schema: { type: 'string' } },
                    { label: 'Due', value: 'due', schema: { type: 'string' } },
                    { label: 'Due Reminder', value: 'dueReminder', schema: { type: 'string' } },
                    { label: 'Member ID', value: 'idMember', schema: { type: 'string' } },
                    { label: 'Limits', value: 'limits', schema: { type: 'object' } }
                ],
                'out'
            );
        } else if (outputType === 'array') {
            return context.sendJson(
                [
                    {
                        label: 'Checklist Items',
                        value: 'array',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    idChecklist: { title: 'Checklist ID', type: 'string' },
                                    id: { title: 'Checklist Item ID', type: 'string' },
                                    pos: { title: 'Position', type: 'number' },
                                    state: { title: 'State', type: 'string' },
                                    due: { title: 'Due', type: 'string' },
                                    dueReminder: { title: 'Due Reminder', type: 'string' },
                                    idMember: { title: 'Member ID', type: 'string' },
                                    limits: { title: 'Limits', type: 'object' }
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

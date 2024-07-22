'use strict';
const commons = require('../../trello-commons');

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { checklistId, outputType, isSource } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        if (isSource) {
            if (!checklistId) {
                return context.sendJson({ checklistId: [] }, 'out');
            }
        }

        const { data } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            url: `https://api.trello.com/1/checklists/${checklistId}/checkitems?${commons.getAuthQueryParams(context)}`
        });
context.log({ step: 'receive', data });

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
                    { label: 'Checklist ID', value: 'idChecklist' },
                    { label: 'Checklist Item ID', value: 'id' },
                    { label: 'Position', value: 'pos' },
                    { label: 'State', value: 'state' },
                    { label: 'Due', value: 'due' },
                    { label: 'Due Reminder', value: 'dueReminder' },
                    { label: 'Member ID', value: 'idMember' },
                    { label: 'Limits', value: 'limits', 'schema': { type: 'object' } }
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

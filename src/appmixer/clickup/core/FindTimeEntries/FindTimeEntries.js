'use strict';
const ClickUpClient = require('../../ClickUpClient');
const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { teamId, startDate, endDate, outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        if (!teamId) {
            throw new context.CancelError('Team ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const params = {};
        if (startDate) {
            params.start_date = Date.parse(startDate);
        }
        if (endDate) {
            params.end_date = Date.parse(endDate);
        }

        const response = await clickUpClient.request('GET', `/team/${teamId}/time_entries`, { params });

        const records = response.data || [];

        if (!records || records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({
            context,
            outputPortName: 'out',
            outputType,
            records
        });
    },

    getOutputPortOptions(context, outputType) {

        const itemSchema = {
            id: { type: 'string', title: 'Time Entry ID' },
            description: { type: 'string', title: 'Description' },
            start: { type: 'string', title: 'Start' },
            end: { type: 'string', title: 'End' },
            duration: { type: 'string', title: 'Duration' },
            billable: { type: 'boolean', title: 'Billable' },
            'task.id': { type: 'string', title: 'Task ID' },
            'task.name': { type: 'string', title: 'Task Name' },
            'user.id': { type: 'number', title: 'User ID' },
            'user.username': { type: 'string', title: 'Username' }
        };

        return lib.getOutputPortOptions(context, outputType, itemSchema, {
            label: 'Time Entries',
            value: 'result'
        });
    }
};

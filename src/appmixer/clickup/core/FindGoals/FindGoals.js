'use strict';
const ClickUpClient = require('../../ClickUpClient');
const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { teamId, outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        if (!teamId) {
            throw new context.CancelError('Team ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const response = await clickUpClient.request('GET', `/team/${teamId}/goal`);
        const goals = response.goals || [];

        if (!goals || goals.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({
            context,
            outputPortName: 'out',
            outputType,
            records: goals,
            arrayKey: 'result'
        });
    },

    getOutputPortOptions(context, outputType) {

        const itemSchema = {
            id: { type: 'string', title: 'Goal ID' },
            name: { type: 'string', title: 'Name' },
            description: { type: 'string', title: 'Description' },
            color: { type: 'string', title: 'Color' },
            date_created: { type: 'string', title: 'Date Created' },
            due_date: { type: 'string', title: 'Due Date' },
            percent_completed: { type: 'number', title: 'Percent Completed' }
        };

        return lib.getOutputPortOptions(context, outputType, itemSchema, {
            label: 'Goals',
            value: 'result'
        });
    }
};

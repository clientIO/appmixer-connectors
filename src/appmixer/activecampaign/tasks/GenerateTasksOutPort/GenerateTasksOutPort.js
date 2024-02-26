'use strict';
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async receive(context) {

        const {
            relationship
        } = context.properties;

        return context.sendJson({ relationship }, 'out');
    },

    getTasksOutput({ relationship }) {

        const fields = [
            { label: 'Task ID', value: 'id' },
            { label: 'Relationship', value: 'relationship' },
            { label: 'Title', value: 'title' },
            { label: 'Description', value: 'note' },
            { label: 'Task type', value: 'taskType' },
            { label: 'Assignee', value: 'assignee' },
            { label: 'Due datetime', value: 'due' },
            { label: 'Estimated completion datetime', value: 'edate' }
        ];


        switch (relationship) {
            case 'contact':
                fields.push({ label: 'Contact ID', value: 'contactId' });
                break;
            case 'deal':
                fields.push({ label: 'Deal ID', value: 'dealId' });
                break;
            default:
                fields.push({ label: 'Contact ID', value: 'contactId' });
                fields.push({ label: 'Deal ID', value: 'dealId' });
                break;
        }

        return fields;
    }
};

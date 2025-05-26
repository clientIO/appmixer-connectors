'use strict';

const lib = require('../../lib');

const mutation = `mutation CreateTask(
    $assignedToUid: ID,
    $attributes: CreateTaskAttributes!
) {
    createTask(
        assignedToUid: $assignedToUid,
        attributes: $attributes
    ) {
        failReasons
        record {
            id
            title
            description {
                plainText
            }
            assignedTo {
                id
                email
            }
            createdAt
            updatedAt
        }
    }
}`;

module.exports = {
    async receive(context) {
        const { assignedToUid, title, description } = context.messages.in.content;

        const variables = {
            assignedToUid,
            attributes: {
                title,
                description
            }
        };

        const { data } = await lib.makeApiCall({
            context,
            method: 'POST',
            data: { query: mutation, variables }
        });

        if (data.data.createTask.failReasons && data.data.createTask.failReasons.length > 0) {
            throw new context.CancelError(data.data.createTask.failReasons.join(', '));
        }

        return context.sendJson(data.data.createTask.record, 'out');
    }
};

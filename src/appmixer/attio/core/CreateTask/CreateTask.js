'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const {
            content,
            deadlineAt,
            assigneeEmails,
            linkedObject,
            linkedRecordId,
            isCompleted
        } = context.messages.in.content;

        if (!content) {
            throw new context.CancelError('Content is required!');
        }
        if (linkedRecordId && !linkedObject) {
            throw new context.CancelError('Linked Record Object is required when Linked Record ID is set!');
        }

        const data = await lib.apiRequest(context, {
            method: 'POST',
            path: '/v2/tasks',
            data: {
                data: {
                    content,
                    format: 'plaintext',
                    deadline_at: deadlineAt ? new Date(deadlineAt).toISOString() : null,
                    is_completed: !!isCompleted,
                    linked_records: linkedRecordId
                        ? [{ target_object: linkedObject, target_record_id: linkedRecordId }]
                        : [],
                    assignees: lib.splitList(assigneeEmails).map(email => ({ workspace_member_email_address: email }))
                }
            }
        });

        return context.sendJson(lib.mapTask(data.data), 'out');
    }
};

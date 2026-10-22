'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { taskId, deadlineAt, isCompleted, assigneeEmails } = context.messages.in.content;

        if (!taskId) {
            throw new context.CancelError('Task ID is required!');
        }

        const update = {};
        if (deadlineAt) update.deadline_at = new Date(deadlineAt).toISOString();
        if (isCompleted === true || isCompleted === 'true') update.is_completed = true;
        if (isCompleted === false || isCompleted === 'false') update.is_completed = false;
        const emails = lib.splitList(assigneeEmails);
        if (emails.length) update.assignees = emails.map(email => ({ workspace_member_email_address: email }));

        if (Object.keys(update).length === 0) {
            throw new context.CancelError('Set at least one of Deadline, Completed or Assignee Emails.');
        }

        await lib.apiRequest(context, {
            method: 'PATCH',
            path: '/v2/tasks/' + encodeURIComponent(taskId),
            data: { data: update }
        });

        return context.sendJson({}, 'out');
    }
};

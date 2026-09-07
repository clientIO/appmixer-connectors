'use strict';

const commons = require('../../jira-commons');

module.exports = {

    async receive(context) {

        const { profileInfo: { apiUrl }, auth } = context;
        const { id, accountId } = context.messages.in.content;

        if (!id) {
            throw new context.CancelError('Issue ID or Key is required!');
        }
        if (!accountId) {
            throw new context.CancelError('Assignee ID is required!');
        }

        await commons.put(
            `${apiUrl}issue/${id}/assignee`,
            auth,
            { accountId }
        );
        return context.sendJson({ id, accountId }, 'issue');
    }
};

'use strict';

const commons = require('../../jira-commons');

module.exports = {

    async receive(context) {

        const { profileInfo: { apiUrl }, auth } = context;
        const { id, accountId } = context.messages.in.content;

        await commons.put(
            `${apiUrl}issue/${id}/assignee`,
            auth,
            { accountId }
        );
        return context.sendJson({ id, accountId }, 'issue');
    }
};

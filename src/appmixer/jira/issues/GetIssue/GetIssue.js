'use strict';

const commons = require('../../jira-commons');

module.exports = {

    async receive(context) {

        const { profileInfo, auth } = context;
        const { id } = context.messages.in.content;

        if (!id) {
            throw new context.CancelError('Issue ID or Key is required!');
        }

        const issue = await commons.get(
            `${profileInfo.apiUrl}issue/${id}`,
            auth
        );
        return context.sendJson(issue, 'issue');
    }
};

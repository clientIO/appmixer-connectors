'use strict';

const commons = require('../../jira-commons');

module.exports = {

    async receive(context) {

        const { profileInfo, auth } = context;
        const { id } = context.messages.in.content;

        const issue = await commons.get(
            `${profileInfo.apiUrl}issue/${id}`,
            auth
        );
        return context.sendJson(issue, 'issue');
    }
};

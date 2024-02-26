'use strict';

const commons = require('../../jira-commons');

module.exports = {

    async receive(context) {

        const { profileInfo: { apiUrl }, auth } = context;
        const { id } = context.messages.in.content;

        await commons.delete(
            `${apiUrl}project/${id}`,
            auth
        );
        return context.sendJson({ id }, 'deleted');
    }
};

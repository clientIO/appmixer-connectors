'use strict';

const commons = require('../../jira-commons');

module.exports = {

    async receive(context) {

        const { profileInfo: { apiUrl }, auth } = context;
        const { id } = context.messages.in.content;

        if (!id) {
            throw new context.CancelError('Project ID or Key is required!');
        }

        await commons.delete(
            `${apiUrl}project/${id}`,
            auth
        );
        return context.sendJson({}, 'out');
    }
};

'use strict';

const commons = require('../../jira-commons');

module.exports = {

    async receive(context) {

        const { profileInfo: { apiUrl }, auth } = context;
        let { type, endpoint } = context.messages.in.content;

        if (type === 'assignee') {
            endpoint = `${apiUrl}user/search?query=`;
        }

        const response = await commons.get(endpoint, auth);
        return context.sendJson(response, 'out');
    },

    fieldToSelectArray(response) {

        if (Array.isArray(response)) {

            const filtered = response.filter(res => {
                if (res.emailAddress) {
                    return res;
                }
            });

            return filtered.map(res => {

                return {
                    label: res.displayName,
                    value: res.accountId
                };
            });
        }

        return [];
    }
};

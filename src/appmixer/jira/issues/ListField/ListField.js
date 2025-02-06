'use strict';

const commons = require('../../jira-commons');

module.exports = {

    async receive(context) {

        const { profileInfo: { apiUrl }, auth } = context;
        let { endpoint } = context.messages.in.content;

        // Fix labels endpoint. The one provided by Get create issue metadata is not working.
        if (endpoint.includes('rest/api/1.0/labels/suggest')) {
            endpoint = `${apiUrl}label`;
            const response = await commons.get(endpoint, auth);

            return context.sendJson(response?.values, 'out');
        }

        // Fix reporters endpoint. The one provided by Get create issue metadata is not working
        if (endpoint.includes('rest/api/3/user/recommend?context=Reporter')) {
            endpoint = `${apiUrl}users`;
            const response = await commons.get(endpoint, auth);
            const filteredReporters = response.filter(user => user.active && user.accountType === 'atlassian');
            return context.sendJson(filteredReporters, 'out');
        }

        const response = await commons.get(endpoint, auth);
        return context.sendJson(response, 'out');
    },

    fieldToSelectArray(response) {

        if (Array.isArray(response)) {

            // If response is an array of strings, eg. for labels
            if (typeof response[0] === 'string') {
                return response.map(res => {
                    return {
                        label: res,
                        value: res
                    };
                });
            }

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

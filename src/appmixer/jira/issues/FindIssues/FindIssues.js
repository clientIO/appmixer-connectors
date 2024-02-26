'use strict';
const commons = require('../../jira-commons');

/**
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { profileInfo: { apiUrl }, auth } = context;
        const { query, validateQuery, maxResults, sendWholeArray } = context.messages.in.content;

        const found = await commons.get(
            `${apiUrl}search`,
            auth,
            { jql: query, maxResults, validateQuery }
        );

        const promises = [];
        if (found && found.issues) {
            if (sendWholeArray) {
                return context.sendJson({ issues: found.issues }, 'issue');
            }

            found.issues.forEach(issue => {
                promises.push(context.sendJson(issue, 'issue'));
            });
        }

        return Promise.all(promises);
    }
};

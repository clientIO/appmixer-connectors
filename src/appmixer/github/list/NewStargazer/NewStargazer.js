'use strict';
const Promise = require('bluebird');
const commons = require('../../lib');

/**
 * Component which triggers whenever new stargazer stars a repo
 * @extends {Component}
 */
module.exports = {
    async tick(context) {
        let { repositoryId } = context.properties;

        const res = await commons.apiRequest(context, `repos/${repositoryId}/stargazers`);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;

        const { diff, actual } = commons.getNewItems(known, res.data, 'id');

        if (diff.length) {
            await Promise.map(diff, issue => {
                return context.sendJson(issue, 'stargazer');
            });
        }

        await context.saveState({ known: actual });
    }
};

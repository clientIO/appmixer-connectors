'use strict';
const lib = require('../../lib');
const Promise = require('bluebird');

/**
 * Component which triggers whenever new milestone is created
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { repositoryId, username } = context.properties;

        const query = `review-requested:${username}+repo:${repositoryId}+is:pr`;

        const result = await lib.apiRequest(context, `search/issues?q=${query}`);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, result.data.items, 'id');

        if (diff.length) {
            await Promise.map(diff, result => {
                return context.sendJson(result, 'out');
            });
        }
        await context.saveState({ known: actual });
    }
};


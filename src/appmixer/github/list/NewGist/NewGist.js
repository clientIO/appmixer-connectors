'use strict';
const Promise = require('bluebird');
const lib = require('../../lib');

/**
 * https://docs.github.com/en/rest/gists/gists?apiVersion=2022-11-28#list-gists-for-the-authenticated-user
 */
module.exports = {

    async tick(context) {

        const res = await lib.apiRequestPaginated(context, 'gists');

        const known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;

        const { diff, actual } = lib.getNewItems(known, res, 'id');

        if (diff.length) {
            await Promise.map(diff, branch => {
                context.sendJson(branch, 'gist');
            });
        }
        await context.saveState({ known: actual });
    }
};


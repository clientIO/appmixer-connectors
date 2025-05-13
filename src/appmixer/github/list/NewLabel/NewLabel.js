'use strict';
const lib = require('../../lib');
const Promise = require('bluebird');

/**
 * Component which triggers whenever new label is created
 * @extends {Component}
 */
module.exports = {

    async tick(context) {
        let { repositoryId } = context.properties;

        const res = await lib.apiRequest(context, `repos/${repositoryId}/labels`);
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, res.data, 'id');

        if (diff.length) {
            await Promise.map(diff, label => {
                return context.sendJson(label, 'label');
            });
        }
        await context.saveState({ known: actual });
    }
};


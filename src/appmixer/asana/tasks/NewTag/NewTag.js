'use strict';
const commons = require('../../asana-commons');
const Promise = require('bluebird');

/**
 * Process tags to find newly added.
 * @param {Set} knownTags
 * @param {Set} actualTags
 * @param {Set} newTags
 * @param {Object} tag
 */
function processTags(knownTags, actualTags, newTags, tag) {

    if (knownTags && !knownTags.has(tag['gid'])) {
        newTags.add(tag);
    }
    actualTags.add(tag['gid']);
}

/**
 * Component which triggers whenever new tag is added.
 * @extends {Component}
 */
module.exports = {

    tick(context) {

        const client = commons.getAsanaAPI(context.auth.accessToken);
        let workspaceId = context.properties.workspace;

        return client.tags.findAll({ workspace: workspaceId })
            .then(res => {

                let promises = [];
                let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
                let actual = new Set();
                let diff = new Set();

                res.data.forEach(processTags.bind(null, known, actual, diff));
                context.state = { known: Array.from(actual) };

                if (diff.size) {
                    diff.forEach(tag => {
                        promises.push(client.tags.findById(tag.gid));
                    });
                }
                return Promise.all(promises);
            })
            .then(data => {
                return Promise.map(data, tag => {
                    return context.sendJson(tag, 'tag');
                });
            });
    }
};

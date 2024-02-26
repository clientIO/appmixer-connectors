'use strict';
const commons = require('../../asana-commons');
const Promise = require('bluebird');

/**
 * Process comments to find newly added.
 * @param {Set} knownComments
 * @param {Set} actualComments
 * @param {Set} newComments
 * @param {Object} comment
 */
function processComments(knownComments, actualComments, newComments, comment) {

    if (knownComments && !knownComments.has(comment['gid'])) {
        newComments.add(comment);
    }
    actualComments.add(comment['gid']);
}

/**
 * Component which triggers whenever new comment is added.
 * @extends {Component}
 */
module.exports = {

    tick(context) {

        const client = commons.getAsanaAPI(context.auth.accessToken);
        let taskId = context.properties.task;

        return client.tasks.stories(taskId)
            .then(res => {

                let promises = [];
                let commentsArray = [];

                let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
                let actual = new Set();
                let diff = new Set();

                res.data.forEach(story => {
                    if (story.type === 'comment') {
                        commentsArray.push(story);
                    }
                });

                commentsArray.forEach(processComments.bind(null, known, actual, diff));
                context.state = { known: Array.from(actual) };

                if (diff.size) {
                    diff.forEach(comment => {
                        promises.push(client.stories.findById(comment.gid));
                    });
                }
                return Promise.all(promises);
            })
            .then(data => {
                return Promise.map(data, comment => {
                    return context.sendJson(comment, 'comment');
                });
            });
    }
};

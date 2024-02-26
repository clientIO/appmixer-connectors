'use strict';
const commons = require('../../asana-commons');
const Promise = require('bluebird');

/**
 * Process stories to find newly added.
 * @param {Set} knownStories
 * @param {Set} actualStories
 * @param {Set} newStories
 * @param {Object} story
 */
function processStories(knownStories, actualStories, newStories, story) {

    if (knownStories && !knownStories.has(story['gid'])) {
        newStories.add(story);
    }
    actualStories.add(story['gid']);
}

/**
 * Component which triggers whenever new story on task is added.
 * @extends {Component}
 */
module.exports = {

    tick(context) {

        const client = commons.getAsanaAPI(context.auth.accessToken);
        let taskId = context.properties.task;

        return client.tasks.stories(taskId)
            .then(res => {

                let promises = [];
                let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
                let actual = new Set();
                let diff = new Set();

                res.data.forEach(processStories.bind(null, known, actual, diff));
                context.state = { known: Array.from(actual) };

                if (diff.size) {
                    diff.forEach(story => {
                        promises.push(client.stories.findById(story.gid));
                    });
                }
                return Promise.all(promises);
            })
            .then(data => {
                return Promise.map(data, story => {
                    context.sendJson(story, 'story');
                });
            });
    }
};

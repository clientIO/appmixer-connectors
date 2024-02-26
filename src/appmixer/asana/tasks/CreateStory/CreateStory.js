'use strict';
const commons = require('../../asana-commons');

/**
 * Component which creates new story.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const client = commons.getAsanaAPI(context.auth.accessToken);
        let story = context.messages.story.content;
        let task = story.task;
        delete story.task;

        return client.stories.createOnTask(task, story)
            .then(story => {
                return context.sendJson(story, 'newStory');
            });
    }
};

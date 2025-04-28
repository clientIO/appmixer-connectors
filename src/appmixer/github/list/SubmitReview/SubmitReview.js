'use strict';
const lib = require('../../lib');

/**
 * Component for creating a review on pullRequest
 * @extends {Component}
 */
module.exports = {

    async receive(context) {
        const { repositoryId, pullRequest, commitId = '', body = '', event = 'PENDING' } = context.messages.in.content;

        let review = {};
        if (commitId) review.commit_id = commitId;
        if (body) review.body = body;
        if (event) review.event = event;
        const { data } = await lib.apiRequest(context, `repos/${repositoryId}/pulls/${pullRequest}/reviews`, {
            method: 'POST',
            body: review
        });


        return context.sendJson(data, 'out');
    }
};

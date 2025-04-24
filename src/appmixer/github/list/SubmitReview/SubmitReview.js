'use strict';
const lib = require('../../lib');

/**
 * Component for creating a review on pullRequest
 * @extends {Component}
 */
module.exports = {

    async receive(context) {
        const {repositoryId, pullRequest, commitId = '', body = '', event = 'PENDING'} = context.messages.in.content;
        let review = {
            commit_id: commitId,
            body: body,
            event: event
        }
        const { data } = await lib.apiRequest(context, `repos/${repositoryId}/${pullRequest}/reviews`, {
            method: 'POST',
            body: review
        });
        context.log({data});

        return context.sendJson(data, 'out');
    }
};

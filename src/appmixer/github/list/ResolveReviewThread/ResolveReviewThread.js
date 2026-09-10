'use strict';

const lib = require('../../lib');

const mutation = `
    mutation($threadId: ID!) {
        resolveReviewThread(input: { threadId: $threadId }) {
            thread {
                id
                isResolved
                isOutdated
                path
            }
        }
    }
`;

/**
 * Component for marking a pull request review thread as resolved.
 * Resolution is GraphQL-only — REST has no notion of it.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { threadId } = context.messages.in.content;

        if (!threadId) {
            throw new context.CancelError('Thread ID is required!');
        }

        const data = await lib.graphqlRequest(context, mutation, { threadId });
        const thread = data?.resolveReviewThread?.thread;

        if (!thread) {
            throw new context.CancelError(`Review thread '${threadId}' was not resolved — no thread returned.`);
        }

        return context.sendJson(thread, 'out');
    }
};

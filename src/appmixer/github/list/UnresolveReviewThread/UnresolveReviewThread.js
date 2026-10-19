'use strict';

const lib = require('../../lib');

const mutation = `
    mutation($threadId: ID!) {
        unresolveReviewThread(input: { threadId: $threadId }) {
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
 * Component for reopening a resolved pull request review thread.
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
        const thread = data?.unresolveReviewThread?.thread;

        if (!thread) {
            throw new context.CancelError(`Review thread '${threadId}' was not unresolved — no thread returned.`);
        }

        return context.sendJson(thread, 'out');
    }
};

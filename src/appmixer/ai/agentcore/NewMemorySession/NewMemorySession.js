'use strict';

const { ListSessionsCommand } = require('@aws-sdk/client-bedrock-agentcore');
const lib = require('../lib');

module.exports = {

    async tick(context) {

        const { memoryId, actorId } = context.properties;

        if (!memoryId || !actorId) {
            throw new context.CancelError('Memory ID and Actor ID are required!');
        }

        const { dataClient } = lib.init(context);

        const sessions = [];
        let nextToken;
        do {
            const response = await dataClient.send(new ListSessionsCommand({
                memoryId,
                actorId,
                maxResults: 100,
                nextToken
            }));
            sessions.push(...(response.sessionSummaries || []));
            nextToken = response.nextToken;
        } while (nextToken);

        const state = await context.loadState();
        const known = Array.isArray(state.known) ? new Set(state.known) : null;
        const { diff, actual } = lib.getNewItems(known, sessions, 'sessionId');

        if (diff.length) {
            await Promise.all(diff.map(session => context.sendJson(session, 'out')));
        }

        await context.saveState({ known: actual });
    },

    async test(context) {

        const { memoryId, actorId } = context.properties;

        if (!memoryId || !actorId) {
            throw new context.CancelError('Memory ID and Actor ID are required!');
        }

        const { dataClient } = lib.init(context);

        // Surface the most recent session without the dedup baseline used by tick().
        const response = await dataClient.send(new ListSessionsCommand({
            memoryId,
            actorId,
            maxResults: 100
        }));

        const sessions = response.sessionSummaries || [];
        if (!sessions.length) {
            throw new Error('No sessions available to use as test data.');
        }

        const latest = sessions.reduce((newest, session) =>
            (!newest || new Date(session.createdAt) > new Date(newest.createdAt)) ? session : newest, null);

        return context.sendJson(latest, 'out');
    }
};

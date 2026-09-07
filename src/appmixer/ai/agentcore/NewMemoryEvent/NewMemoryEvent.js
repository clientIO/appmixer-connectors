'use strict';

const { ListEventsCommand } = require('@aws-sdk/client-bedrock-agentcore');
const lib = require('../lib');

module.exports = {

    async tick(context) {

        const { memoryId, actorId, sessionId } = context.properties;

        if (!memoryId || !actorId || !sessionId) {
            throw new context.CancelError('Memory ID, Actor ID and Session ID are required!');
        }

        const { dataClient } = lib.init(context);

        const events = [];
        let nextToken;
        do {
            const response = await dataClient.send(new ListEventsCommand({
                memoryId,
                actorId,
                sessionId,
                includePayloads: true,
                maxResults: 100,
                nextToken
            }));
            events.push(...(response.events || []));
            nextToken = response.nextToken;
        } while (nextToken);

        const state = await context.loadState();
        const known = Array.isArray(state.known) ? new Set(state.known) : null;
        const { diff, actual } = lib.getNewItems(known, events, 'eventId');

        if (diff.length) {
            await Promise.all(diff.map(event => context.sendJson(event, 'out')));
        }

        await context.saveState({ known: actual });
    },

    async test(context) {

        const { memoryId, actorId, sessionId } = context.properties;

        if (!memoryId || !actorId || !sessionId) {
            throw new context.CancelError('Memory ID, Actor ID and Session ID are required!');
        }

        const { dataClient } = lib.init(context);

        // Surface the most recent event without the dedup baseline used by tick().
        const response = await dataClient.send(new ListEventsCommand({
            memoryId,
            actorId,
            sessionId,
            includePayloads: true,
            maxResults: 100
        }));

        const events = response.events || [];
        if (!events.length) {
            throw new Error('No events available to use as test data.');
        }

        const latest = events.reduce((newest, event) =>
            (!newest || new Date(event.eventTimestamp) > new Date(newest.eventTimestamp)) ? event : newest, null);

        return context.sendJson(latest, 'out');
    }
};

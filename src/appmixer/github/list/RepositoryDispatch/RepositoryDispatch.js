'use strict';

const lib = require('../../lib');

// Both limits come from the REST API contract for POST /repos/{owner}/{repo}/dispatches.
// Checking them here turns a silent 422 into an actionable CancelError.
const MAX_EVENT_TYPE_LENGTH = 100;
const MAX_CLIENT_PAYLOAD_KEYS = 10;

/**
 * Component for triggering a repository_dispatch event.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { repositoryId, eventType, clientPayload } = context.messages.in.content;

        if (!repositoryId) {
            throw new context.CancelError('Repository is required!');
        }
        if (!eventType) {
            throw new context.CancelError('Event Type is required!');
        }
        if (eventType.length > MAX_EVENT_TYPE_LENGTH) {
            throw new context.CancelError(
                `Event Type must be at most ${MAX_EVENT_TYPE_LENGTH} characters long, got ${eventType.length}.`
            );
        }

        const body = { event_type: eventType };

        if (clientPayload) {
            let parsed;
            try {
                parsed = typeof clientPayload === 'object' ? clientPayload : JSON.parse(clientPayload);
            } catch (err) {
                throw new context.CancelError('Client Payload must be valid JSON.');
            }
            if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new context.CancelError('Client Payload must be a JSON object.');
            }
            const keys = Object.keys(parsed);
            if (keys.length > MAX_CLIENT_PAYLOAD_KEYS) {
                throw new context.CancelError(
                    `Client Payload must have at most ${MAX_CLIENT_PAYLOAD_KEYS} top-level keys, got ${keys.length}.`
                );
            }
            body.client_payload = parsed;
        }

        // Answers 204 No Content.
        await lib.apiRequest(context, `repos/${repositoryId}/dispatches`, {
            method: 'POST',
            body
        });

        return context.sendJson({}, 'out');
    }
};

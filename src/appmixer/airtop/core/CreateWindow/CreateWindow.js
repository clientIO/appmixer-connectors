'use strict';

const lib = require('../../lib');

// Airtop holds the HTTP response open until the requested load event, so this
// bounds how long a single message can keep its receive() (and the worker slot
// behind it) busy. 120s matches the CreateSession readiness ceiling.
const MAX_WAIT_TIMEOUT_SECONDS = 120;

module.exports = {

    async receive(context) {

        const {
            sessionId,
            url,
            waitUntil,
            waitUntilTimeoutSeconds,
            screenResolution
        } = context.messages.in.content;

        if (!sessionId) {
            throw new context.CancelError('Session ID is required!');
        }

        // The default landing URL lives in the `url` input's `defaultValue`
        // (component.json) and is not repeated here — a user who deliberately clears the
        // field gets Airtop's own blank window instead of being sent back to Google.
        const payload = {};

        if (url) {
            payload.url = url;
        }

        if (waitUntil) {
            payload.waitUntil = waitUntil;
        }
        const timeoutSeconds = lib.parseIntegerInput(context, waitUntilTimeoutSeconds, {
            label: 'Wait Timeout',
            min: 1,
            max: MAX_WAIT_TIMEOUT_SECONDS
        });
        if (timeoutSeconds !== undefined) {
            payload.waitUntilTimeoutSeconds = timeoutSeconds;
        }
        if (screenResolution) {
            payload.screenResolution = screenResolution;
        }

        const { data } = await lib.apiRequest(context, {
            method: 'POST',
            path: `/sessions/${encodeURIComponent(sessionId)}/windows`,
            data: payload
        });

        const window = lib.unwrap(context, data);

        return context.sendJson({
            windowId: window.windowId,
            targetId: window.targetId,
            sessionId
        }, 'out');
    }
};

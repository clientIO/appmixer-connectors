'use strict';

const lib = require('../../lib');

// The query is submitted to Airtop's async endpoint and its result collected by a
// scheduled continuation, so no worker is held while the model reads the page. A
// continuation shorter than one minute is silently rounded up to one by the engine,
// so one minute is both the poll interval and the floor.
const POLL_INTERVAL_MS = 60 * 1000;
// Ceiling on the whole wait. Airtop cancels the operation itself at Time Threshold
// (300 s at most); this leaves room for that plus queueing on Airtop's side.
const MAX_WAIT_MS = 15 * 60 * 1000;

module.exports = {

    async receive(context) {

        // ── the continuation scheduled by a previous invocation ──────────────
        if (context.messages.timeout) {
            return collectResult(context, context.messages.timeout.content);
        }

        // ── the submit ──────────────────────────────────────────────────────
        const {
            sessionId,
            windowId,
            prompt,
            outputSchema,
            followPaginationLinks,
            costThresholdCredits,
            timeThresholdSeconds
        } = context.messages.in.content;

        if (!sessionId) {
            throw new context.CancelError('Session ID is required!');
        }
        if (!windowId) {
            throw new context.CancelError('Window ID is required!');
        }
        if (!prompt) {
            throw new context.CancelError('Prompt is required!');
        }

        const payload = { prompt };

        if (followPaginationLinks) {
            payload.followPaginationLinks = true;
        }
        lib.applyThresholds(context, payload, { costThresholdCredits, timeThresholdSeconds });
        if (outputSchema) {
            // The API expects the JSON schema as a string. Validate it first so a typo
            // fails here with a clear message instead of inside Airtop.
            const parsed = lib.parseJsonInput(context, outputSchema, 'Output JSON Schema');
            payload.configuration = { outputSchema: JSON.stringify(parsed) };
        }

        const { data } = await lib.apiRequest(context, {
            method: 'POST',
            path: '/async/sessions/' + encodeURIComponent(sessionId)
                + '/windows/' + encodeURIComponent(windowId) + '/page-query',
            data: payload
        });

        const submitted = lib.unwrap(context, data);
        const requestId = submitted.requestId;

        // Without a request id the query cannot be collected: the continuation would
        // poll `/requests/undefined/status` forever and the flow would stall with no
        // error. Fail here instead.
        if (!requestId) {
            throw new context.CancelError(
                'Airtop accepted the page query but returned no request id, so its result '
                + 'cannot be collected. Retry the query.'
            );
        }

        await context.log({ step: 'Page query submitted', requestId });

        return context.setTimeout({
            requestId,
            deadline: Date.now() + MAX_WAIT_MS
        }, POLL_INTERVAL_MS);
    }
};

/**
 * Poll the async request once and either emit the answer, fail, or schedule the
 * next continuation.
 * @param {object} context
 * @param {object} state - { requestId, deadline } carried in the timeout payload
 * @returns {Promise<*>}
 */
async function collectResult(context, { requestId, deadline }) {

    const { data } = await lib.apiRequest(context, {
        method: 'GET',
        path: `/requests/${encodeURIComponent(requestId)}/status`
    });

    const polled = lib.unwrap(context, data);

    if (polled.status === 'completed') {
        return context.sendJson(readAnswer(context, polled, requestId), 'out');
    }

    if (polled.status === 'error') {
        throw new context.CancelError(
            `The Airtop page query failed: ${polled.error || 'no reason given'}. Request ID: ${requestId}.`
        );
    }

    if (Date.now() >= deadline) {
        throw new context.CancelError(
            `The Airtop page query did not finish within ${MAX_WAIT_MS / 60000} minutes `
            + `(last reported status: ${polled.status || 'unknown'}). Request ID: ${requestId}.`
        );
    }

    return context.setTimeout({ requestId, deadline }, POLL_INTERVAL_MS);
}

/**
 * Map a completed async request onto the component's output. The status endpoint
 * carries the finished operation's own response; when that is the full AI envelope
 * (`meta.status`, `meta.usage`) it is read the same way the other page operations
 * read theirs — including failing closed on a `meta.status` that is not a documented
 * success. A bare payload is accepted too: the poll already reported `completed`.
 * @param {object} context
 * @param {object} polled - the parsed status response
 * @param {string} requestId
 * @returns {object}
 */
function readAnswer(context, polled, requestId) {

    const body = polled.response || {};

    if (body.meta) {
        const result = lib.aiResult(context, body);
        return {
            modelResponse: result.modelResponse,
            status: result.status,
            requestId: result.requestId || requestId,
            credits: result.credits
        };
    }

    const payload = body.data !== undefined ? body.data : body;

    return {
        modelResponse: payload.modelResponse,
        status: 'success',
        requestId,
        credits: ((body.meta || {}).usage || {}).credits
    };
}

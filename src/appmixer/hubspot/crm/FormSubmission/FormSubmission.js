'use strict';
const Hubspot = require('../../Hubspot');

// Default polling interval: 5 minutes
const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000;

module.exports = {

    async start(context) {

        // Seed the last-seen submission time to now so historical submissions are not emitted.
        // Any submission arriving after this baseline (including between start and the first poll)
        // is newer than lastSeenAt and will be picked up.
        const now = Date.now();
        await context.saveState({ lastSeenAt: now });
        return context.setTimeout({}, context.config?.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS);
    },

    async stop(context) {
        // Nothing to clean up for a polling trigger.
    },

    async receive(context) {

        if (!context.messages.timeout) {
            return;
        }

        const { formId } = context.properties;

        try {
            const hubspot = new Hubspot(context.auth.accessToken);
            const state = context.state || {};
            // lastSeenAt is seeded to Date.now() in start(), so historical submissions are already
            // excluded — no first-run flag needed.
            const lastSeenAt = state.lastSeenAt || Date.now();

            let newLastSeenAt = lastSeenAt;
            const newSubmissions = [];

            // Fetch recent submissions. HubSpot returns results newest first.
            // We paginate until we reach submissions older than lastSeenAt.
            let after = undefined;
            let done = false;

            do {
                const params = { limit: 50 };
                if (after) {
                    params.after = after;
                }

                const { data } = await hubspot.call(
                    'get',
                    `form-integrations/v1/submissions/forms/${formId}`,
                    params
                );

                const results = data.results || [];
                after = data.paging?.next?.after;

                for (const submission of results) {
                    const submittedAt = submission.submittedAt || 0;
                    if (submittedAt > lastSeenAt) {
                        newSubmissions.push(submission);
                        if (submittedAt > newLastSeenAt) {
                            newLastSeenAt = submittedAt;
                        }
                    } else {
                        // Submissions are ordered newest first; once we hit an old one we're done.
                        done = true;
                        break;
                    }
                }

                if (!results.length) {
                    done = true;
                }
            } while (after && !done);

            if (newSubmissions.length) {
                // Emit oldest first so downstream components process in chronological order.
                await context.sendArray(newSubmissions.reverse(), 'submission');
            }

            // Advance the watermark only after a successful emit, so a failed send is retried next poll.
            await context.saveState({ lastSeenAt: newLastSeenAt });

        } catch (err) {
            await context.log({ step: 'hubspot-form-submission-poll-error', formId, error: err.message });
        } finally {
            // Always reschedule so one failed poll self-heals instead of permanently killing the trigger.
            await context.setTimeout({}, context.config?.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS);
        }
    },

    async test(context) {

        const { formId } = context.properties;
        const hubspot = new Hubspot(context.auth.accessToken);

        // Latest submission of the configured form — the same raw submission
        // shape receive() emits (submittedAt, values, pageUrl, ...).
        const { data } = await hubspot.call('get', `form-integrations/v1/submissions/forms/${formId}`, { limit: 1 });
        const submission = data.results && data.results[0];
        if (!submission) {
            throw new context.CancelError('The selected form has no submissions to use as test data.');
        }

        return context.sendJson(submission, 'submission');
    }
};

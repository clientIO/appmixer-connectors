'use strict';

module.exports = {
    rules: [
        {
            // Light calls: session listing/details, termination, MakeApiCall, and
            // Query Page — it submits to Airtop's async endpoint and collects the
            // answer in a scheduled continuation, so each of its invocations is one
            // short request rather than a held-open browser operation.
            limit: 10,
            window: 1000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        },
        {
            // Caps how many blocking browser operations are in flight at once: window
            // creation, click, type, screenshot and the session-readiness wait. Airtop
            // holds the HTTP response open for the whole operation, so receive() blocks
            // for its duration and this slot genuinely bounds concurrent work — unlike a
            // submit-and-return component, which is why Query Page is not on this rule. Overflow is shed, not queued: a message that
            // cannot get a slot within the engine's default wait window (10 s) is denied
            // with a 429 and re-enters the retry mechanism with backoff. Do not raise
            // that window with `quota.maxWait` — waiting holds the message unacked and
            // occupies a consumer prefetch slot for the whole wait, which is worse than
            // a retry when the slots are held for minutes at a time.
            limit: 5,
            throttling: 'limit-concurrency',
            queueing: 'fifo',
            resource: 'browser-operations',
            scope: 'userId'
        },
        {
            // Rate ceiling on the same operations, matching the light-call rule.
            limit: 10,
            window: 1000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'browser-operations',
            scope: 'userId'
        }
    ]
};

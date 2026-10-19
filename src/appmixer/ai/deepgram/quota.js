'use strict';

module.exports = {
    rules: [
        {
            // Light metadata calls (projects, models, request logs). Deepgram does not
            // publish a hard rate limit for these, so this is a conservative guard.
            limit: 100,
            window: 1000 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        },
        {
            // Caps how many processing calls (/v1/listen, /v1/speak, /v1/read) are
            // in the air at once, which smooths a burst of a hundred simultaneous
            // submits into something Deepgram will accept.
            //
            // It does NOT cap in-flight *jobs*. A concurrency slot is held for the
            // duration of receive(), and Transcribe Audio now submits and returns in
            // about two seconds instead of blocking until the transcript is ready -
            // the job keeps running on Deepgram's side long after the slot is free.
            // Appmixer quotas cannot express "10 outstanding callbacks"; a project
            // that pushes past Deepgram's own concurrency limit gets a 429, which
            // lib.normalizeError turns into an actionable message.
            limit: 10,
            throttling: 'limit-concurrency',
            queueing: 'fifo',
            resource: 'inference',
            scope: 'userId'
        },
        {
            // Keep a rate ceiling on the processing endpoints as well. This is the
            // rule that actually bounds how fast jobs can be handed to Deepgram.
            limit: 100,
            window: 1000 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'inference',
            scope: 'userId'
        }
    ]
};

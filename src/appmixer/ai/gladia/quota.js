'use strict';

// Gladia does not publish a hard per-minute request ceiling, so we throttle
// conservatively and queue overflow so flows degrade gracefully instead of
// hitting rate-limit errors.
//
// Note that the budget covers polling too: every continuation of Transcribe
// Audio is a full receive() and costs one request, so a transcription waited
// on costs 1 + one per minute of job duration, drawn from the same bucket as
// every other Gladia component for that user. Queued polls only delay a
// result, never lose one - the status is read before the deadline is checked -
// but a flow running many long transcriptions at once will spend most of this
// budget on polling.
module.exports = {

    rules: [
        {
            limit: 60,
            window: 1000 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};

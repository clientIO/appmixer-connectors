'use strict';

module.exports = {
    rules: [
        {
            // Mistral rate limits are workspace/tier dependent. Default to a
            // conservative 60 requests per minute; adjust per deployment if needed.
            limit: 60,
            window: 1000 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        }
    ]
};

'use strict';

module.exports = {

    rules: [
        {
            // Free account is 1000 requests per month.
            // https://rapidapi.com/DeepAI/api/deepai-computer-vision/pricing.
            limit: 1000,
            window: 1000 * 60 * 60 * 24 * 30,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        }
    ]
};

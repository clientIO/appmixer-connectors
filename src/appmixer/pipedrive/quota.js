'use strict';

module.exports = {

    rules: [
        // https://developers.pipedrive.com/docs/api/v1/#/ (Rate limiting)
        // Rate limiting is is considered per API token. API allows to perform 100 requests per 10 seconds.
        {
            limit: 100,                       // the quota is 100 per 10 seconds
            window: 1000 * 10,               // 10 seconds
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};

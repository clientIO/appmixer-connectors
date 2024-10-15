'use strict';

module.exports = {

    rules: [
        {
            // https://developer.zendesk.com/api-reference/introduction/rate-limits/
            // Note that we are applying a conversvative rate limit regardless of the user's plan.
            // The rate limit below is based on the 100req/min limit imposed by the Update ticket endpoint.
            // It's better to stay conversvative than letting the requests error out leading to a bad user experience.
            limit: 100,                       // the quota is 100 per 60 seconds
            window: 1000 * 60,               // 60 seconds
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};

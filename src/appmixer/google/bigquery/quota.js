'use strict';

module.exports = {

    rules: [
        // https://cloud.google.com/bigquery/quotas#api_quotas_and_limits
        // A user can make up to 100 API requests per second to an API method.
        // If a user makes more than 100 requests per second to a method, then throttling can occur.
        {
            limit: 100,
            window: 1000,
            scope: 'userId',
            resource: 'requests'
        },
        // Official docs: Your project can make up to two projects.list requests per second.
        // Tested out: 10 requests per second always fine.
        {
            limit: 10,
            window: 1000,
            scope: 'userId',
            resource: 'projects.list'
        }
    ]
};

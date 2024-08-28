'use strict';

module.exports = {

    rules: [
        // According to salesforce limits are per 24-hour period
        //https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_api.htm
        {
            limit: 15000, // application is allowed to send 15000 queries per 24hrs
            window: 1000 * 60 * 60 * 24, // 24 hours
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        },
        // According to salesforce limits are 25 requests per 20 seconds
        {
            limit: 25, // the quota is 25 per 20 seconds
            window: 1000 * 20, //20 sec
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        }
    ]
};

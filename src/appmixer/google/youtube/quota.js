'use strict';

module.exports = {

    rules: [
        // According to google, this daily limit does not depend on any time-zone related
        // window, it's supposed to be sliding window 24h
        {
            name: 'FindVideos',
            limit: 1000,            // user is allowed to send 1000 queries a day
            window: 1000 * 60 * 60 * 24,        // 24 hours
            scope: 'userId',
            resource: 'FindVideos'
        },
        // According to google, this daily limit does not depend on any time-zone related
        // window, it's supposed to be sliding window 24h
        {
            name: 'GetVideos',
            limit: 10000,            // user is allowed to send 10000 queries a day
            window: 1000 * 60 * 60 * 24,        // 24 hours
            scope: 'userId',
            resource: 'GetVideos'
        }
    ]
};

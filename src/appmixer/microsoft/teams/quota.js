'use strict';

// Microsoft Graph throttles Teams per app per tenant (e.g. 20 rps for GET/POST chat and
// channel messages, 30 rps for joinedTeams, 60 rps for channels) and per chat/channel
// (1 rps). The quota can only be scoped by user, so keep each user well below the
// tenant-wide limits; bursts over the per-resource limit are retried in commons.js.
// https://learn.microsoft.com/en-us/graph/throttling-limits#microsoft-teams-service-limits
module.exports = {

    rules: [
        {
            limit: 4,               // 4 requests per second
            window: 1000,
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};

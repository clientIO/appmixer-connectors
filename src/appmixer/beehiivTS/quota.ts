// quota.ts - Rate limiting configuration. Pure data, minimal typing needed.
import type {} from './types'; // ensures types.ts is referenced

module.exports = {

    rules: [
        {
            limit: 5,
            window: 1000,
            queueing: 'fifo',
            resource: 'requests'
        }
    ]
};

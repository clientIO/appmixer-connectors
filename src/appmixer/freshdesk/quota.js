'use strict';

module.exports = {

    rules: [
        // According to freshdesk limits are 100/200/400/700 requests per minute, according to user plan
        {
            limit: 100, // the quota is 100 per 60 seconds
            window: 1000 * 60, //60 sec
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        },
        // Ticket creation limit rate is 40/80/160/280 per minute, according to user plan
        {
            limit: 40,
            window: 1000 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'tickets.create'
        },
        // Ticket updating limit rate is 40/80/160/280 per minute, according to user plan
        {
            limit: 40,
            window: 1000 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'tickets.update'
        },
        // Ticket listing limit rate is 50/60/100/200 per minute, according to user plan
        {
            limit: 50,
            window: 1000 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'tickets.polling'
        },
        // Contacts listing limit rate is 50/60/100/200 per minute, according to user plan
        {
            limit: 50,
            window: 1000 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'contacts.polling'
        }
    ]
};

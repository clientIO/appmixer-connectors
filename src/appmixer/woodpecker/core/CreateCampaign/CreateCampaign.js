'use strict';

const lib = require('../../lib');

// POST /v2/campaigns requires the full campaign structure: settings (timezone,
// daily_enroll), at least one connected email account id and a steps tree that
// starts with a START step followed by an EMAIL step with delivery times and a
// body version. Delivery defaults to workdays 8:00-18:00.
const DELIVERY_TIME = {
    MONDAY: [{ from: '08:00', to: '18:00' }],
    TUESDAY: [{ from: '08:00', to: '18:00' }],
    WEDNESDAY: [{ from: '08:00', to: '18:00' }],
    THURSDAY: [{ from: '08:00', to: '18:00' }],
    FRIDAY: [{ from: '08:00', to: '18:00' }]
};

module.exports = {

    async receive(context) {

        const { name, emailAccountId, subject, message, timezone, dailyEnroll } = context.messages.in.content;

        if (!name) {
            throw new context.CancelError('Name is required!');
        }
        if (!emailAccountId) {
            throw new context.CancelError('Email Account ID is required! Use the List Mailboxes component to find it.');
        }
        if (!subject) {
            throw new context.CancelError('Subject is required!');
        }
        if (!message) {
            throw new context.CancelError('Message is required!');
        }

        const data = {
            name,
            'email_account_ids': [parseInt(emailAccountId, 10)],
            settings: {
                timezone: timezone || 'Europe/London',
                'daily_enroll': dailyEnroll || 20
            },
            steps: {
                type: 'START',
                followup: {
                    type: 'EMAIL',
                    'delivery_time': DELIVERY_TIME,
                    body: {
                        versions: [{
                            subject,
                            message,
                            signature: 'NO_SIGNATURE',
                            'track_opens': true
                        }]
                    }
                }
            }
        };

        const response = await context.httpRequest({
            method: 'POST',
            url: `${lib.API_BASE_URL}/v2/campaigns`,
            headers: lib.getHeaders(context),
            data
        });

        return context.sendJson(response.data, 'out');
    }
};

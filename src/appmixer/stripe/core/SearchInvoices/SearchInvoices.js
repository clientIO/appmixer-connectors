'use strict';

const lib = require('../../lib.generated');

const schema = {
    id: { type: 'string', title: 'Invoice ID' },
    object: { type: 'string', title: 'Object Type' },
    account_country: { type: 'string', title: 'Account Country' },
    account_name: { type: 'string', title: 'Account Name' },
    amount_due: { type: 'number', title: 'Amount Due' },
    amount_paid: { type: 'number', title: 'Amount Paid' },
    amount_remaining: { type: 'number', title: 'Amount Remaining' },
    currency: { type: 'string', title: 'Currency' },
    created: { type: 'number', title: 'Created (Unix Timestamp)' },
    customer: { type: 'string', title: 'Customer ID' },
    customer_email: { type: ['string', 'null'], title: 'Customer Email' },
    customer_name: { type: ['string', 'null'], title: 'Customer Name' },
    status: { type: 'string', title: 'Status' },
    hosted_invoice_url: { type: ['string', 'null'], title: 'Hosted Invoice URL' },
    invoice_pdf: { type: ['string', 'null'], title: 'Invoice PDF URL' },
    livemode: { type: 'boolean', title: 'Live Mode' },
    period_start: { type: 'number', title: 'Period Start (Unix Timestamp)' },
    period_end: { type: 'number', title: 'Period End (Unix Timestamp)' },
    subtotal: { type: 'number', title: 'Subtotal' },
    total: { type: 'number', title: 'Total' }
};

module.exports = {
    async receive(context) {
        const { query, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, {
                label: 'data',
                value: 'data'
            });
        }

        // Stripe: https://stripe.com/docs/api/invoices/search
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.stripe.com/v1/invoices/search',
            headers: {
                Authorization: `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            params: {
                query,
                limit: 100 // Default limit, can be adjusted as needed
            }
        });

        return lib.sendArrayOutput({
            context,
            records: data.data,
            outputType,
            arrayPropertyValue: 'data'
        });
    }
};

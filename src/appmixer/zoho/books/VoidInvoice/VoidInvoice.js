'use strict';
const ZohoClient = require('../../ZohoClient');

module.exports = {

    async receive(context) {

        const { invoice_id, organization_id } = context.messages.in.content;
        const zc = new ZohoClient(context);
        const result = await zc.request(
            'POST',
            '/books/v3/invoices/' + invoice_id + '/status/void',
            { params: { organization_id } }
        );

        return context.sendJson(result, 'out');
    }
};

'use strict';
const ZohoClient = require('../../ZohoClient');

module.exports = {

    async receive(context) {

        const { invoice_id, organization_id } = context.messages.in.content;
        const zc = new ZohoClient(context);
        const { invoice } = await zc.request(
            'GET',
            '/books/v3/invoices/' + invoice_id,
            { params: { organization_id } }
        );

        return context.sendJson(invoice, 'out');
    }
};

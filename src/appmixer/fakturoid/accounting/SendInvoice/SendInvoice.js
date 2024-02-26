'use strict';
const fakturoid = require('../../fakturoid-commons');

module.exports = {

    receive(context) {

        let attributes = context.messages.attributes.content;
        let invoiceId = attributes['invoice_id'];
        delete attributes['invoice_id'];

        return fakturoid.post('/invoices/' + invoiceId + '/message.json', context.auth, attributes)
            .then(invoice => {
                return context.sendJson(invoice, 'invoice');
            });
    }
};

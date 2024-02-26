'use strict';
const fakturoid = require('../../fakturoid-commons');

module.exports = {

    receive(context) {

        let invoice = context.messages.invoice.content;
        // Convert tags (comma separated list) to an array.
        if (invoice.tags) {
            invoice.tags = invoice.tags.split(',').map(tag => tag.trim());
        }

        return fakturoid.post('/invoices.json', context.auth, invoice)
            .then(invoice => {
                return context.sendJson(invoice, 'newInvoice');
            });
    }
};

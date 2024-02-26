'use strict';
const fakturoid = require('../../fakturoid-commons');
const Promise = require('bluebird');

module.exports = {

    receive(context) {

        let query = context.messages.query.content.query;

        return fakturoid.get('/invoices/search.json', context.auth, { query })
            .then(invoices => {
                return Promise.map(invoices, invoice => {
                    return context.sendJson(invoice, 'invoice');
                });
            });
    }
};

'use strict';
const fakturoid = require('../../fakturoid-commons');
const Promise = require('bluebird');

module.exports = {

    async tick(context) {

        let invoices = await fakturoid.get('/invoices.json', context.auth, {});
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = [];
        let diff = [];

        if (Array.isArray(invoices)) {
            invoices.forEach(context.utils.processItem.bind(
                null, known, actual, diff, item => item.id));
        }

        await Promise.map(diff, invoice => {
            context.sendJson(invoice, 'invoice');
        });
        await context.saveState({ known: actual });
    }
};

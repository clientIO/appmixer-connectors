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
    },

    async test(context) {

        // Reuse the same request path as tick(). The list endpoint returns invoices
        // newest-first by default, so emit the first (latest) one. No dedup/state:
        // tick() suppresses the first poll (baseline), but test() must return a real item.
        const invoices = await fakturoid.get('/invoices.json', context.auth, {});
        const invoice = Array.isArray(invoices) ? invoices[0] : null;
        if (!invoice) {
            throw new Error('No recent invoice to use as test data.');
        }
        return context.sendJson(invoice, 'invoice');
    }
};

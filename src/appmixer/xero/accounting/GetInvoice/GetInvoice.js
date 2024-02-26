'use strict';
const XeroClient = require('../../XeroClient');

module.exports = {

    async receive(context) {

        const {
            tenantId,
            InvoiceID
        } = context.messages.in.content;

        const xc = new XeroClient(context, tenantId);
        const { Invoices } = await xc.request('GET', '/api.xro/2.0/Invoices/' + InvoiceID, {});

        return context.sendJson(Invoices[0], 'out');
    }
};

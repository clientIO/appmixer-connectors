'use strict';
const XeroClient = require('../../XeroClient');

// Possibly change it later to AddAttachment.js only and select entity (Invoice, Contact, Account, etc.) from the dropdown.
module.exports = {

    async receive(context) {

        const {
            tenantId,
            invoiceId,
            filename,
            attachment
        } = context.messages.in.content;

        const data = await context.loadFile(attachment);

        const xc = new XeroClient(context, tenantId);
        const path = '/api.xro/2.0/Invoices/' + invoiceId + '/Attachments/' + filename;
        const { Attachments } = await xc.request('POST', path, { data });

        return context.sendJson(Attachments[0], 'out');
    }
};

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

        if (!tenantId) {
            throw new context.CancelError('Tenant ID is required!');
        }
        if (!invoiceId) {
            throw new context.CancelError('Invoice ID is required!');
        }
        if (!filename) {
            throw new context.CancelError('File name is required!');
        }
        if (!attachment) {
            throw new context.CancelError('Attachment is required!');
        }

        const data = await context.loadFile(attachment);

        const xc = new XeroClient(context, tenantId);
        const path = '/api.xro/2.0/Invoices/' + invoiceId + '/Attachments/' + filename;
        const { Attachments } = await xc.request('POST', path, { data });

        return context.sendJson(Attachments[0], 'out');
    }
};

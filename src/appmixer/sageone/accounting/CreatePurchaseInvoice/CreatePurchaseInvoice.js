'use strict';
const commons = require('../../sageone-commons');

function buildInvoice(invoiceFields) {

    let purchaseInvoice = {
        'contact_id': invoiceFields.contactId,
        'contact_name': invoiceFields.contactName,
        date: invoiceFields.date,
        'due_date': invoiceFields.dueDate,
        'carriage_tax_code_id': invoiceFields.carriageTaxCodeId,
        'line_items_attributes': [
            {
                description: invoiceFields.description
            }
        ]
    };

    if (invoiceFields.productId) {
        purchaseInvoice['line_items_attributes'][0]['product_id'] = invoiceFields.productId;
    }

    if (invoiceFields.quantity) {
        purchaseInvoice['line_items_attributes'][0]['quantity'] = invoiceFields.quantity;
    }

    if (invoiceFields.unitPrice) {
        purchaseInvoice['line_items_attributes'][0]['unit_price'] = invoiceFields.unitPrice;
    }

    if (invoiceFields.taxCodeId) {
        purchaseInvoice['line_items_attributes'][0]['tax_code_id'] = invoiceFields.taxCodeId;
    }

    if (invoiceFields.ledgerAccountId) {
        purchaseInvoice['line_items_attributes'][0]['ledger_account_id'] = invoiceFields.ledgerAccountId;
    }

    return { 'purchase_invoice': purchaseInvoice };
}

/**
 * Create new purchase invoice in Sageone.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const token = context.auth.accessToken;
        const clientSigningSecret = context.auth.profileInfo.clientSigningSecret;
        const userAgent = context.auth.profileInfo.userAgent;
        const url = 'https://api.sageone.com/accounts/v2/purchase_invoices';
        const purchaseInvoice = context.messages.purchaseInvoice.content;
        const data = buildInvoice(purchaseInvoice);

        return commons.sageoneAPI('POST', token, url, userAgent, clientSigningSecret, data)
            .then(purchaseInvoice => {
                const data = JSON.parse(purchaseInvoice);
                return context.sendJson(data, 'newPurchaseInvoice');
            });
    }
};

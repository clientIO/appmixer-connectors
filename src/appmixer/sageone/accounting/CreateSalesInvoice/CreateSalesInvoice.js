'use strict';
const commons = require('../../sageone-commons');

function buildInvoice(invoiceFields) {

    let salesInvoice = {
        'contact_id': invoiceFields.contactId,
        'contact_name': invoiceFields.contactName,
        date: invoiceFields.date,
        'due_date': invoiceFields.dueDate,
        'main_address': invoiceFields.mainAddress,
        'carriage_tax_code_id': invoiceFields.carriageTaxCodeId,
        'line_items_attributes': [
            {
                description: invoiceFields.description
            }
        ]
    };

    if (invoiceFields.productId) {
        salesInvoice['line_items_attributes'][0]['product_id'] = invoiceFields.productId;
    }

    if (invoiceFields.quantity) {
        salesInvoice['line_items_attributes'][0]['quantity'] = invoiceFields.quantity;
    }

    if (invoiceFields.unitPrice) {
        salesInvoice['line_items_attributes'][0]['unit_price'] = invoiceFields.unitPrice;
    }

    if (invoiceFields.taxCodeId) {
        salesInvoice['line_items_attributes'][0]['tax_code_id'] = invoiceFields.taxCodeId;
    }

    if (invoiceFields.ledgerAccountId) {
        salesInvoice['line_items_attributes'][0]['ledger_account_id'] = invoiceFields.ledgerAccountId;
    }

    return { 'sales_invoice': salesInvoice };
}

/**
 * Create new contact in Zoho.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const token = context.auth.accessToken;
        const clientSigningSecret = context.auth.profileInfo.clientSigningSecret;
        const userAgent = context.auth.profileInfo.userAgent;
        const url = 'https://api.sageone.com/accounts/v1/sales_invoices';
        const salesInvoice = context.messages.salesInvoice.content;
        const data = buildInvoice(salesInvoice);

        return commons.sageoneAPI('POST', token, url, userAgent, clientSigningSecret, data)
            .then(salesInvoice => {
                const data = JSON.parse(salesInvoice);
                return context.sendJson(data, 'newSalesInvoice');
            });
    }
};

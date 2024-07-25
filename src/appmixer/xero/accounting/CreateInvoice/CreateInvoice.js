'use strict';
const XeroClient = require('../../XeroClient');

module.exports = {

    async receive(context) {

        const {
            tenantId,
            Type,
            ContactID,
            LineItems,
            Date,
            DueDate,
            LineAmountTypes,
            InvoiceNumber,
            Reference,
            BrandingThemeID,
            Url,
            Status,
            CurrencyCode,
            CurrencyRate,
            SentToContact,
            ExpectedPaymentDate,
            PlannedPaymentDate
        } = context.messages.in.content;

        const data = {
            // Creating only one invoice even though the API supports an array.
            Invoices: [
                {
                    Type,
                    Contact: { ContactID },
                    // // LineItems,
                    Date,
                    DueDate,
                    LineAmountTypes,
                    InvoiceNumber,
                    Reference,
                    BrandingThemeID,
                    Url,
                    CurrencyCode,
                    CurrencyRate,
                    Status,
                    SentToContact,
                    ExpectedPaymentDate,
                    PlannedPaymentDate
                }
            ]
        };

        // Structure of this field is not clear from the docs.
        if (LineItems) {
            try {
                data.Invoices[0].LineItems = JSON.parse(LineItems);
            } catch (e) {
                // If the value is not a valid JSON, throw an error.
                throw new context.CancelError('Error parsing LineItems. Please check the syntax.', e);
            }
        }

        const xc = new XeroClient(context, tenantId);
        const { Invoices } = await xc.request('PUT', '/api.xro/2.0/Invoices', { data });

        return context.sendJson(Invoices[0], 'out');
    }
};

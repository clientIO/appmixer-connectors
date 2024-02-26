'use strict';
const XeroClient = require('../../XeroClient');

module.exports = {

    async receive(context) {

        const {
            tenantId,
            Name,
            ContactNumber,
            AccountNumber,
            ContactStatus,
            FirstName,
            LastName,
            CompanyNumber,
            EmailAddress,
            BankAccountDetails,
            TaxNumber,
            AccountsReceivableTaxType,
            AccountsPayableTaxType,
            DefaultCurrency,
            SalesDefaultAccountCode,
            PurchasesDefaultAccountCode,
            // Arrays
            Addresses,
            Phones,
            // ContactGroups
            // SalesTrackingCategories
            // PurchasesTrackingCategories
            // Objects
            PaymentTerms
        } = context.messages.in.content;

        const addresses = (Addresses?.AND || []).filter(a => a.AddressLine1);
        const phones = (Phones?.AND || []).filter(p => p.PhoneNumber);
        const data = {
            Contacts: [
                {
                    Name,
                    ContactNumber,
                    AccountNumber,
                    ContactStatus,
                    FirstName,
                    LastName,
                    CompanyNumber,
                    EmailAddress,
                    BankAccountDetails,
                    TaxNumber,
                    AccountsReceivableTaxType,
                    AccountsPayableTaxType,
                    DefaultCurrency,
                    SalesDefaultAccountCode,
                    PurchasesDefaultAccountCode,
                    // Arrays
                    Addresses: addresses,
                    Phones: phones
                }
            ]
        };

        // Structure of this field is not clear from the docs.
        if (PaymentTerms) {
            try {
                data.PaymentTerms = JSON.parse(PaymentTerms);
            } catch (e) {
                // If the value is not a valid JSON, just pass it as is.
                data.PaymentTerms = PaymentTerms;
            }
        }

        const xc = new XeroClient(context, tenantId);
        const { Contacts } = await xc.request('PUT', '/api.xro/2.0/Contacts', { data });

        return context.sendJson(Contacts[0], 'out');
    }
};

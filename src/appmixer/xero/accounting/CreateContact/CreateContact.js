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

        if (!tenantId) {
            throw new context.CancelError('Tenant ID is required!');
        }
        if (!Name) {
            throw new context.CancelError('Name is required!');
        }

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

        // Xero reads PaymentTerms from the contact object; on the request root it was silently
        // ignored. The inspector takes it as a JSON string ({ Sales: { Day, Type }, Bills: { Day, Type } }).
        if (PaymentTerms) {
            if (typeof PaymentTerms === 'object') {
                data.Contacts[0].PaymentTerms = PaymentTerms;
            } else {
                try {
                    data.Contacts[0].PaymentTerms = JSON.parse(PaymentTerms);
                } catch (e) {
                    throw new context.CancelError(
                        'Payment Terms must be a JSON object, e.g. { "Sales": { "Day": 10, "Type": "DAYSAFTERBILLMONTH" } }.'
                    );
                }
            }
        }

        const xc = new XeroClient(context, tenantId);
        const { Contacts } = await xc.request('PUT', '/api.xro/2.0/Contacts', { data });

        return context.sendJson(Contacts[0], 'out');
    }
};

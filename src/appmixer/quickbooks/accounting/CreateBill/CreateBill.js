'use strict';
const { makeRequest } = require('../../commons');

module.exports = {

    async receive(context) {

        const {
            vendorId,
            minorVersion,
            lineItemsJSON,
            currency,
            dueDate,
            ...optionalInputs
        } = context.messages.in.content;

        let lineItems = [];
        try {
            lineItems = JSON.parse(lineItemsJSON);
        } catch (error) {
            throw new context.CancelError('Invalid JSON for line items. Details: ' + error.message);
        }

        /** Linked transactions */
        let linkedTxn = [];
        try {
            linkedTxn = JSON.parse(optionalInputs['linkedTxnJSON'] || '[]');
        } catch (error) {
            throw new context.CancelError('Invalid JSON for linkedTxn. Details: ' + error.message);
        }

        const options = {
            path: `v3/company/${context.profileInfo.companyId}/bill?minorversion=${minorVersion}`,
            method: 'POST',
            data: {
                VendorRef: {
                    value: vendorId
                },
                Line: lineItems,
                CurrencyRef: {
                    value: currency
                },
                DueDate: dueDate,
                TxnDate: optionalInputs['txnDate'],
                DocNumber: optionalInputs['docNumber'],
                PrivateNote: optionalInputs['privateNote'],
                APAccountRef: {
                    value: optionalInputs['apAccountId']
                },
                SalesTermRef: {
                    value: optionalInputs['salesTermId']
                },
                DepartmentRef: {
                    value: optionalInputs['departmentId']
                },
                LinkedTxn: linkedTxn,
                ExchangeRate: optionalInputs['exchangeRate']
            }
        };
        const response = await makeRequest({ context, options });
        return context.sendJson(response.data?.Bill, 'out');
    }
};

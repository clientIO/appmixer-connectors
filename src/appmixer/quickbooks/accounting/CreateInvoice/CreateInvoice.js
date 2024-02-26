'use strict';
const { makeRequest } = require('../../commons');

const getAddress = (context, type) => {

    const inputs = context.messages.in.content;

    return {
        PostalCode: inputs[`${type}AddrPostalCode`],
        City: inputs[`${type}AddrCity`],
        Country: inputs[`${type}AddrCountry`],
        Line2: inputs[`${type}AddrLine2`],
        Line1: inputs[`${type}AddrLine1`],
        Lat: inputs[`${type}AddrLat`],
        Long: inputs[`${type}AddrLon`],
        CountrySubDivisionCode: inputs[`${type}AddrCountrySubDivisionCode`]
    };
};

module.exports = {

    async receive(context) {

        const {
            customerId,
            minorVersion,
            lineItems,
            lineItemsJSON,
            currency,
            billEmail,
            billEmailCc,
            shipDate,
            dueDate,
            customerMemo,
            ...optionalInputs
        } = context.messages.in.content;

        // SalesItemLineDetail only from inspector expression fields.
        const lineItemsArray = lineItems?.AND?.map(item => {
            return {
                DetailType: 'SalesItemLineDetail',
                Amount: item.amount,
                Description: item.description,
                SalesItemLineDetail: {
                    Qty: item.quantity
                }
            };
        });

        let lineItemsJSONArray;
        try {
            lineItemsJSONArray = JSON.parse(lineItemsJSON);
        } catch (e) {
            throw new context.CancelError('Invalid JSON in "Line Items JSON"');
        }

        const options = {
            path: `v3/company/${context.profileInfo.companyId}/invoice?minorversion=${minorVersion}`,
            method: 'POST',
            data: {
                CustomerRef: {
                    value: customerId
                },
                Line: lineItemsArray || lineItemsJSONArray,
                CurrencyRef: {
                    value: currency
                },
                BillEmail: {
                    Address: billEmail
                },
                BillEmailCc: {
                    Address: billEmailCc
                },
                ShipFromAddr: getAddress(context, 'shipFromAddr'),
                BillAddr: getAddress(context, 'billAddr'),
                ShipDate: shipDate,
                DueDate: dueDate,
                CustomerMemo: {
                    value: customerMemo
                },
                DocNumber: optionalInputs['docNumber'],
                TrackingNum: optionalInputs['trackingNum'],
                PrintStatus: optionalInputs['printStatus'],
                GlobalTaxCalculation: optionalInputs['globalTaxCalculation'],
                AllowOnlineACHPayment: optionalInputs['allowOnlineACHPayment'],
                PrivateNote: optionalInputs['privateNote'],
                ExchangeRate: optionalInputs['exchangeRate'],
                Deposit: optionalInputs['deposit'],
                AllowOnlineCreditCardPayment: optionalInputs['allowOnlineCreditCardPayment'],
                ApplyTaxAfterDiscount: optionalInputs['applyTaxAfterDiscount'],
                TxnDate: optionalInputs['TxnDate']
            }
        };

        context.log({ step: 'Making request', options });
        const response = await makeRequest({ context, options });
        return context.sendJson(response.data?.Invoice, 'out');
    }
};

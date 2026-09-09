'use strict';
const { sendArrayOutput } = require('../../commons');
const XeroClient = require('../../XeroClient');

const outputPortName = 'out';

const ITEM_SCHEMA = {
    type: 'object',
    properties: {
        PurchaseOrderID: { type: 'string', title: 'Purchase Order ID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
        PurchaseOrderNumber: { type: 'string', title: 'Purchase Order Number', example: 'PO-0001' },
        Reference: { type: 'string', title: 'Reference', example: 'PO-REF-001' },
        Type: { type: 'string', title: 'Type', example: 'PURCHASEORDER' },
        Status: { type: 'string', title: 'Status', example: 'DRAFT' },
        Contact: { type: 'object', title: 'Contact' },
        Date: { type: 'string', title: 'Date', example: '/Date(1704067200000+0000)/' },
        DateString: { type: 'string', title: 'Date String', example: '2026-01-15' },
        DeliveryDate: { type: 'string', title: 'Delivery Date', example: '/Date(1704067200000+0000)/' },
        DeliveryDateString: { type: 'string', title: 'Delivery Date String', example: '2026-01-20' },
        LineAmountTypes: { type: 'string', title: 'Line Amount Types', example: 'Exclusive' },
        LineItems: {
            type: 'array', title: 'Line Items',
            items: {
                type: 'object',
                properties: {
                    Description: { type: 'string', title: 'Description' },
                    UnitAmount: { type: 'number', title: 'Unit Amount' },
                    Quantity: { type: 'number', title: 'Quantity' },
                    LineAmount: { type: 'number', title: 'Line Amount' },
                    TaxAmount: { type: 'number', title: 'Tax Amount' },
                    TaxType: { type: 'string', title: 'Tax Type' },
                    AccountCode: { type: 'string', title: 'Account Code' },
                    ItemCode: { type: 'string', title: 'Item Code' },
                    LineItemID: { type: 'string', title: 'Line Item ID' },
                    DiscountRate: { type: 'number', title: 'Discount Rate' }
                }
            }
        },
        SubTotal: { type: 'number', title: 'Sub Total', example: 1000.0 },
        TotalTax: { type: 'number', title: 'Total Tax', example: 100.0 },
        Total: { type: 'number', title: 'Total', example: 1100.0 },
        TotalDiscount: { type: 'number', title: 'Total Discount', example: 50.0 },
        CurrencyCode: { type: 'string', title: 'Currency Code', example: 'USD' },
        CurrencyRate: { type: 'number', title: 'Currency Rate', example: 1.0 },
        UpdatedDateUTC: { type: 'string', title: 'Updated Date UTC', example: '2026-01-15T10:30:00Z' },
        HasAttachments: { type: 'boolean', title: 'Has Attachments', example: false },
        HasErrors: { type: 'boolean', title: 'Has Errors', example: false },
        IsDiscounted: { type: 'boolean', title: 'Is Discounted', example: false },
        BrandingThemeID: { type: 'string', title: 'Branding Theme ID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
        Url: { type: 'string', title: 'Url', example: 'https://example.com/po/1' },
        SentToContact: { type: 'boolean', title: 'Sent To Contact', example: false },
        DeliveryAddress: { type: 'string', title: 'Delivery Address', example: '123 Main St, Springfield' },
        AttentionTo: { type: 'string', title: 'Attention To', example: 'John Smith' },
        Telephone: { type: 'string', title: 'Telephone', example: '+1-555-0100' },
        DeliveryInstructions: { type: 'string', title: 'Delivery Instructions', example: 'Leave at reception' },
        ExpectedArrivalDate: { type: 'string', title: 'Expected Arrival Date', example: '2026-01-20' }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { tenantId, Status, DateFrom, DateTo, outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        if (!tenantId) {
            throw new context.CancelError('Tenant ID is required.');
        }

        const params = {};
        if (Status) {
            params.Status = Status;
        }
        if (DateFrom) {
            params.DateFrom = DateFrom;
        }
        if (DateTo) {
            params.DateTo = DateTo;
        }

        const xc = new XeroClient(context, tenantId);
        const records = await xc.requestPaginated('GET', '/api.xro/2.0/PurchaseOrders', {
            dataKey: 'PurchaseOrders',
            params
        });

        if (!records || records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return sendArrayOutput({
            context,
            outputPortName,
            outputType,
            records
        });
    },

    getOutputPortOptions(context, outputType) {

        const lineItemsSchema = {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    Description: { type: 'string', title: 'Description' },
                    UnitAmount: { type: 'number', title: 'UnitAmount' },
                    Quantity: { type: 'number', title: 'Quantity' },
                    LineAmount: { type: 'number', title: 'LineAmount' },
                    TaxAmount: { type: 'number', title: 'TaxAmount' },
                    TaxType: { type: 'string', title: 'TaxType' },
                    AccountCode: { type: 'string', title: 'AccountCode' },
                    ItemCode: { type: 'string', title: 'ItemCode' },
                    LineItemID: { type: 'string', title: 'LineItemID' },
                    DiscountRate: { type: 'number', title: 'DiscountRate' }
                }
            }
        };

        const itemSchema = [
            { label: 'Purchase Order ID', value: 'PurchaseOrderID', schema: { type: 'string', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' } },
            { label: 'Purchase Order Number', value: 'PurchaseOrderNumber', schema: { type: 'string', example: 'PO-0001' } },
            { label: 'Reference', value: 'Reference', schema: { type: 'string' } },
            { label: 'Type', value: 'Type', schema: { type: 'string', example: 'PURCHASEORDER' } },
            { label: 'Status', value: 'Status', schema: { type: 'string', example: 'DRAFT' } },
            { label: 'Contact', value: 'Contact', schema: { type: 'object' } },
            { label: 'Date', value: 'Date', schema: { type: 'string' } },
            { label: 'Date String', value: 'DateString', schema: { type: 'string', example: '2026-01-15' } },
            { label: 'Delivery Date', value: 'DeliveryDate', schema: { type: 'string' } },
            { label: 'Delivery Date String', value: 'DeliveryDateString', schema: { type: 'string' } },
            { label: 'Line Amount Types', value: 'LineAmountTypes', schema: { type: 'string', example: 'Exclusive' } },
            { label: 'Line Items', value: 'LineItems', schema: lineItemsSchema },
            { label: 'Sub Total', value: 'SubTotal', schema: { type: 'number', example: 1000.0 } },
            { label: 'Total Tax', value: 'TotalTax', schema: { type: 'number', example: 100.0 } },
            { label: 'Total', value: 'Total', schema: { type: 'number', example: 1100.0 } },
            { label: 'Total Discount', value: 'TotalDiscount', schema: { type: 'number' } },
            { label: 'Currency Code', value: 'CurrencyCode', schema: { type: 'string', example: 'USD' } },
            { label: 'Currency Rate', value: 'CurrencyRate', schema: { type: 'number' } },
            { label: 'Updated Date UTC', value: 'UpdatedDateUTC', schema: { type: 'string' } },
            { label: 'Has Attachments', value: 'HasAttachments', schema: { type: 'boolean' } },
            { label: 'Has Errors', value: 'HasErrors', schema: { type: 'boolean' } },
            { label: 'Is Discounted', value: 'IsDiscounted', schema: { type: 'boolean' } },
            { label: 'Branding Theme ID', value: 'BrandingThemeID', schema: { type: 'string' } },
            { label: 'Url', value: 'Url', schema: { type: 'string' } },
            { label: 'Sent To Contact', value: 'SentToContact', schema: { type: 'boolean' } },
            { label: 'Delivery Address', value: 'DeliveryAddress', schema: { type: 'string' } },
            { label: 'Attention To', value: 'AttentionTo', schema: { type: 'string' } },
            { label: 'Telephone', value: 'Telephone', schema: { type: 'string' } },
            { label: 'Delivery Instructions', value: 'DeliveryInstructions', schema: { type: 'string' } },
            { label: 'Expected Arrival Date', value: 'ExpectedArrivalDate', schema: { type: 'string' } }
        ];

        if (outputType === 'item') {
            return context.sendJson(itemSchema, outputPortName);
        } else if (outputType === 'items') {
            return context.sendJson(
                [{
                    label: 'Purchase Orders',
                    value: 'items',
                    schema: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                PurchaseOrderID: { type: 'string', title: 'PurchaseOrderID' },
                                PurchaseOrderNumber: { type: 'string', title: 'PurchaseOrderNumber' },
                                Reference: { type: 'string', title: 'Reference' },
                                Type: { type: 'string', title: 'Type' },
                                Status: { type: 'string', title: 'Status' },
                                Contact: { type: 'object', title: 'Contact' },
                                Date: { type: 'string', title: 'Date' },
                                DateString: { type: 'string', title: 'DateString' },
                                DeliveryDate: { type: 'string', title: 'DeliveryDate' },
                                DeliveryDateString: { type: 'string', title: 'DeliveryDateString' },
                                LineAmountTypes: { type: 'string', title: 'LineAmountTypes' },
                                LineItems: { ...lineItemsSchema, title: 'LineItems' },
                                SubTotal: { type: 'number', title: 'SubTotal' },
                                TotalTax: { type: 'number', title: 'TotalTax' },
                                Total: { type: 'number', title: 'Total' },
                                TotalDiscount: { type: 'number', title: 'TotalDiscount' },
                                CurrencyCode: { type: 'string', title: 'CurrencyCode' },
                                CurrencyRate: { type: 'number', title: 'CurrencyRate' },
                                UpdatedDateUTC: { type: 'string', title: 'UpdatedDateUTC' },
                                HasAttachments: { type: 'boolean', title: 'HasAttachments' },
                                HasErrors: { type: 'boolean', title: 'HasErrors' },
                                IsDiscounted: { type: 'boolean', title: 'IsDiscounted' },
                                BrandingThemeID: { type: 'string', title: 'BrandingThemeID' },
                                Url: { type: 'string', title: 'Url' },
                                SentToContact: { type: 'boolean', title: 'SentToContact' },
                                DeliveryAddress: { type: 'string', title: 'DeliveryAddress' },
                                AttentionTo: { type: 'string', title: 'AttentionTo' },
                                Telephone: { type: 'string', title: 'Telephone' },
                                DeliveryInstructions: { type: 'string', title: 'DeliveryInstructions' },
                                ExpectedArrivalDate: { type: 'string', title: 'ExpectedArrivalDate' }
                            }
                        }
                    }
                }],
                outputPortName
            );
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], outputPortName);
        }
    }
};

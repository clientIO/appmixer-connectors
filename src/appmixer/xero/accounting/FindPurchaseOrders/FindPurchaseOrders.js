'use strict';
const { sendArrayOutput } = require('../../commons');
const XeroClient = require('../../XeroClient');

const outputPortName = 'out';

const ITEM_SCHEMA = {
    type: 'object',
    required: ['PurchaseOrderID', 'PurchaseOrderNumber', 'Type', 'Status'],
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

        const props = ITEM_SCHEMA.properties;

        // item — one option per field, derived from ITEM_SCHEMA
        const itemOptions = Object.entries(props).map(([key, def]) => ({
            label: def.title,
            value: key,
            schema: def
        }));

        if (outputType === 'item') {
            return context.sendJson(itemOptions, outputPortName);
        } else if (outputType === 'items') {
            return context.sendJson(
                [{
                    label: 'Purchase Orders',
                    value: 'items',
                    schema: {
                        type: 'array',
                        items: ITEM_SCHEMA
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

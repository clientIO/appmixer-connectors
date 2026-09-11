'use strict';
const XeroClient = require('../../XeroClient');

module.exports = {

    async receive(context) {

        const {
            tenantId,
            ContactID,
            LineItems,
            Date,
            DeliveryDate,
            LineAmountTypes,
            PurchaseOrderNumber,
            Reference,
            CurrencyCode,
            CurrencyRate,
            Status,
            SentToContact,
            DeliveryAddress,
            AttentionTo,
            Telephone,
            DeliveryInstructions,
            ExpectedArrivalDate,
            BrandingThemeID,
            Url
        } = context.messages.in.content;

        if (!tenantId) {
            throw new context.CancelError('Tenant ID is required.');
        }
        if (!ContactID) {
            throw new context.CancelError('Contact ID is required.');
        }
        if (!LineItems) {
            throw new context.CancelError('Line Items is required.');
        }

        const purchaseOrder = {
            Contact: { ContactID },
            Date,
            DeliveryDate,
            LineAmountTypes,
            PurchaseOrderNumber,
            Reference,
            CurrencyCode,
            CurrencyRate,
            Status,
            SentToContact,
            DeliveryAddress,
            AttentionTo,
            Telephone,
            DeliveryInstructions,
            ExpectedArrivalDate,
            BrandingThemeID,
            Url
        };

        if (LineItems) {
            try {
                purchaseOrder.LineItems = JSON.parse(LineItems);
            } catch (e) {
                throw new context.CancelError('Error parsing LineItems. Please check the syntax.', e);
            }
        }

        const data = { PurchaseOrders: [purchaseOrder] };

        const xc = new XeroClient(context, tenantId);
        const { PurchaseOrders } = await xc.request('PUT', '/api.xro/2.0/PurchaseOrders', { data });

        return context.sendJson(PurchaseOrders[0], 'out');
    }
};

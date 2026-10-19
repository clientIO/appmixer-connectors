'use strict';
const XeroClient = require('../../XeroClient');

module.exports = {

    async receive(context) {

        const {
            tenantId,
            PurchaseOrderID,
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
        if (!PurchaseOrderID) {
            throw new context.CancelError('Purchase Order ID is required.');
        }

        const purchaseOrder = {};

        if (ContactID) purchaseOrder.Contact = { ContactID };
        if (Date) purchaseOrder.Date = Date;
        if (DeliveryDate) purchaseOrder.DeliveryDate = DeliveryDate;
        if (LineAmountTypes) purchaseOrder.LineAmountTypes = LineAmountTypes;
        if (PurchaseOrderNumber) purchaseOrder.PurchaseOrderNumber = PurchaseOrderNumber;
        if (Reference) purchaseOrder.Reference = Reference;
        if (CurrencyCode) purchaseOrder.CurrencyCode = CurrencyCode;
        if (CurrencyRate !== undefined && CurrencyRate !== null) purchaseOrder.CurrencyRate = CurrencyRate;
        if (Status) purchaseOrder.Status = Status;
        if (SentToContact !== undefined && SentToContact !== null) purchaseOrder.SentToContact = SentToContact;
        if (DeliveryAddress) purchaseOrder.DeliveryAddress = DeliveryAddress;
        if (AttentionTo) purchaseOrder.AttentionTo = AttentionTo;
        if (Telephone) purchaseOrder.Telephone = Telephone;
        if (DeliveryInstructions) purchaseOrder.DeliveryInstructions = DeliveryInstructions;
        if (ExpectedArrivalDate) purchaseOrder.ExpectedArrivalDate = ExpectedArrivalDate;
        if (BrandingThemeID) purchaseOrder.BrandingThemeID = BrandingThemeID;
        if (Url) purchaseOrder.Url = Url;

        if (LineItems) {
            try {
                purchaseOrder.LineItems = JSON.parse(LineItems);
            } catch (e) {
                throw new context.CancelError('Error parsing LineItems. Please check the syntax.', e);
            }
        }

        const data = { PurchaseOrders: [purchaseOrder] };

        const xc = new XeroClient(context, tenantId);
        const { PurchaseOrders } = await xc.request('POST', `/api.xro/2.0/PurchaseOrders/${PurchaseOrderID}`, { data });

        return context.sendJson(PurchaseOrders[0], 'out');
    }
};

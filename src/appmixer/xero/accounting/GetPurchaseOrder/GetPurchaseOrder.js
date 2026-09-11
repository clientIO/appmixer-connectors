'use strict';
const XeroClient = require('../../XeroClient');

module.exports = {

    async receive(context) {

        const { tenantId, PurchaseOrderID } = context.messages.in.content;

        if (!tenantId) {
            throw new context.CancelError('Tenant ID is required.');
        }
        if (!PurchaseOrderID) {
            throw new context.CancelError('Purchase Order ID is required.');
        }

        const xc = new XeroClient(context, tenantId);
        const { PurchaseOrders } = await xc.request('GET', `/api.xro/2.0/PurchaseOrders/${PurchaseOrderID}`, {});

        return context.sendJson(PurchaseOrders[0], 'out');
    }
};

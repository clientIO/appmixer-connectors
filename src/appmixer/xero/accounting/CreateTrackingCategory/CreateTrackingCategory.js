'use strict';
const XeroClient = require('../../XeroClient');

module.exports = {

    async receive(context) {

        const { tenantId, name } = context.messages.in.content;

        if (!tenantId) {
            throw new context.CancelError('Tenant ID is required!');
        }
        if (!name) {
            throw new context.CancelError('Category Name is required!');
        }

        const xc = new XeroClient(context, tenantId);
        const response = await xc.request('PUT', '/api.xro/2.0/TrackingCategories', {
            data: { Name: name }
        });

        const categories = response && response.TrackingCategories;
        if (!categories || !categories.length) {
            throw new context.CancelError('No tracking category returned from Xero API.');
        }

        const created = categories[0];
        return context.sendJson(created, 'out');
    }
};

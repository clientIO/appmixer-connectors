'use strict';
const XeroClient = require('../../XeroClient');

module.exports = {

    async receive(context) {

        const { tenantId, trackingCategoryId, name } = context.messages.in.content;

        if (!tenantId) {
            throw new context.CancelError('Tenant ID is required!');
        }
        if (!trackingCategoryId) {
            throw new context.CancelError('Tracking Category ID is required!');
        }
        if (!name) {
            throw new context.CancelError('Option Name is required!');
        }

        const xc = new XeroClient(context, tenantId);
        const response = await xc.request('PUT', `/api.xro/2.0/TrackingCategories/${trackingCategoryId}/Options`, {
            data: { Name: name }
        });

        const options = response && response.Options;
        if (!options || !options.length) {
            throw new context.CancelError('No tracking option returned from Xero API.');
        }

        const created = options[0];
        return context.sendJson(created, 'out');
    }
};

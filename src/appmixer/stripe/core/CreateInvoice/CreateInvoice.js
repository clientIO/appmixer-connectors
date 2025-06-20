'use strict';

module.exports = {
    async receive(context) {

        const { customer, collectionMethod, description, autoAdvance } = context.messages.in.content;

        // https://stripe.com/docs/api/invoices/create
        const invoiceData = {};
        if (customer !== undefined && customer !== '') invoiceData.customer = customer;
        if (collectionMethod !== undefined && collectionMethod !== '') invoiceData.collection_method = collectionMethod;
        if (description !== undefined && description !== '') invoiceData.description = description;
        if (autoAdvance !== undefined && autoAdvance !== '') invoiceData.auto_advance = Boolean(autoAdvance);

        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.stripe.com/v1/invoices',
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: invoiceData
        });

        return context.sendJson(data, 'out');
    }
};

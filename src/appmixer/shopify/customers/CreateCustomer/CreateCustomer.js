'use strict';
const commons = require('../../shopify-commons');

function buildCustomer(customerInfo) {

    let metafields = [];
    if (customerInfo.metafields && Array.isArray(customerInfo.metafields.ADD)) {
        metafields = customerInfo.metafields.ADD.filter(metafield => metafield.key !== '');
    }

    const customer = {
        'first_name': customerInfo.firstName,
        'last_name': customerInfo.lastName,
        'email': customerInfo.email ? customerInfo.email : '',
        'phone': customerInfo.phone ? customerInfo.phone : '',
        'verified_email': customerInfo.email ? true : false,
        'accepts_marketing': customerInfo.accepts_marketing,
        'addresses': [{
            'first_name': customerInfo.addressFName ? customerInfo.addressFName : customerInfo.firstName,
            'last_name': customerInfo.addressLName ? customerInfo.addressLName : customerInfo.lastName,
            'phone': customerInfo.addressPhone ? customerInfo.addressPhone : '',
            'address1': customerInfo.address1 ? customerInfo.address1 : '',
            'city': customerInfo.city ? customerInfo.city : '',
            'country': customerInfo.country ? customerInfo.country : '',
            'province': customerInfo.province ? customerInfo.province : '',
            'zip': customerInfo.zip ? customerInfo.zip : ''
        }],
        'note': customerInfo.note ? customerInfo.note : '',
        'tags': customerInfo.tags ? customerInfo.tags : '',
        'tax_exempt': customerInfo.tax_exempt
    };

    if (customerInfo.accepts_marketing_updated_at) {
        customer['accepts_marketing_updated_at'] = customerInfo.accepts_marketing_updated_at;
    }

    if (Array.isArray(customerInfo.tax_exemptions)) {
        customer['tax_exemptions'] = customerInfo.tax_exemptions;
    }

    if (metafields.length > 0) {
        customer['metafields'] = metafields;
    }

    return customer;
}

/**
 * Create customer.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);

        const customerInfo = context.messages.in.content;

        const customer = await shopify.customer.create(buildCustomer(customerInfo));
        return context.sendJson(customer, 'customer');
    }
};

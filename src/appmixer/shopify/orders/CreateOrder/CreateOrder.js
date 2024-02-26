'use strict';
const commons = require('../../shopify-commons');

function buildOrder(orderInfo) {

    const { email, phone, currency, note, tags, test } = orderInfo;

    let discountCodes = [];
    if (orderInfo.discount_codes && Array.isArray(orderInfo.discount_codes.ADD)) {
        discountCodes = orderInfo.discount_codes.ADD.filter(discount => discount.code !== '' && discount.amount !== '');
    }

    let taxLines = [];
    if (orderInfo.tax_lines && Array.isArray(orderInfo.tax_lines.ADD)) {
        taxLines = orderInfo.tax_lines.ADD.filter(tax => tax.title !== '' && tax.price !== '' && tax.rate !== '');
    }

    let customer = {};
    if (orderInfo.customer_id) {
        customer.id = orderInfo.customer_id;
    } else {
        customer = {
            'first_name': orderInfo.customer_first_name,
            'last_name': orderInfo.customer_last_name,
            'email': orderInfo.customer_email,
            'phone': orderInfo.customer_phone,
            'accepts_marketing': orderInfo.customer_accepts_marketing,
            'accepts_marketing_updated_at': orderInfo.customer_accepts_marketing_updated_at
        };
    }

    const order = {
        email,
        phone,
        currency,
        note,
        tags,
        test,
        customer,
        'line_items': orderInfo.line_items.ADD,
        'buyer_accepts_marketing': orderInfo.buyer_accepts_marketing,
        'financial_status': orderInfo.financial_status,
        'fulfillment_status': orderInfo.fulfillment_status === 'null' ? null : orderInfo.fulfillment_status,
        'total_discounts': orderInfo.total_discounts,
        'discount_codes': discountCodes,
        'taxes_included': orderInfo.taxes_included,
        'tax_lines': taxLines
    };

    if (orderInfo.billing_first_name && orderInfo.billing_last_name && orderInfo.billing_address1) {
        order['billing_address'] = {
            'first_name': orderInfo.billing_first_name,
            'last_name': orderInfo.billing_last_name,
            'phone': orderInfo.billing_phone,
            'address1': orderInfo.billing_address1,
            'city': orderInfo.billing_city,
            'country': orderInfo.billing_country,
            'province': orderInfo.billing_province,
            'zip': orderInfo.billing_zip
        };
    }

    if (orderInfo.shipping_first_name && orderInfo.shipping_last_name && orderInfo.shipping_address1) {
        order['shipping_address'] = {
            'first_name': orderInfo.shipping_first_name,
            'last_name': orderInfo.shipping_last_name,
            'phone': orderInfo.shipping_phone,
            'address1': orderInfo.shipping_address1,
            'city': orderInfo.shipping_city,
            'country': orderInfo.shipping_country,
            'province': orderInfo.shipping_province,
            'zip': orderInfo.shipping_zip
        };
    }

    return order;
}

/**
 * Create an order.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        if (context.properties.generateInspector) {
            const products = await context.componentStaticCall('appmixer.shopify.products.ListProducts', 'products', {
                properties: {
                    sendWholeArray: true
                },
                transform: './ListProducts#variantsToSelectArray'
            });
            return context.sendJson(products, 'order');
        }

        const shopify = commons.getShopifyAPI(context.auth);
        const orderInput = buildOrder(context.messages.in.content);

        await context.log({ step: 'Creating order: ', ...orderInput });
        const order = await shopify.order.create(orderInput);
        return context.sendJson(order, 'order');
    },

    toInspector(products) {

        products.unshift({ 'clearItem': true, 'content': '-- Clear selection --' });

        return {
            schema: {
                type: 'object',
                properties: {
                    line_items: {
                        type: 'object',
                        properties: {
                            ADD: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        variantType: { type: 'string' },
                                        variant_id: {
                                            anyOf: [
                                                {
                                                    type: 'string',
                                                    pattern: '^[0-9a-zA-Z-]{1,}$'
                                                },
                                                {
                                                    type: 'number'
                                                }
                                            ]
                                        },
                                        title: {
                                            type: 'string',
                                            pattern: '^(?!\\s*$).+'
                                        },
                                        price: { 'type': 'number', 'min': 0 },
                                        grams: { 'type': 'number', 'min': 0 },
                                        quantity: { 'type': 'number', 'min': 0 },
                                        taxable: { 'type': 'boolean' },
                                        requires_shipping: { 'type': 'boolean' }
                                    },
                                    oneOf: [
                                        { required: ['variant_id', 'quantity'] },
                                        { required: ['title', 'price', 'quantity'] }
                                    ]
                                }
                            }
                        }
                    },
                    email: { 'type': 'string' },
                    phone: { 'type': 'string' },
                    buyer_accepts_marketing: { 'type': 'boolean' },
                    financial_status: { 'type': 'string' },
                    fulfillment_status: { 'type': 'string' },
                    currency: { 'type': 'string' },
                    total_discounts: { 'type': 'number' },
                    discount_codes: { 'type': 'object' },
                    taxes_included: { 'type': 'boolean' },
                    tax_lines: { 'type': 'object' },
                    note: { 'type': 'string' },
                    tags: { 'type': 'string' },
                    customer_id: { 'type': 'string' },
                    customer_first_name: { 'type': 'string' },
                    customer_last_name: { 'type': 'string' },
                    customer_email: { 'type': 'string' },
                    customer_phone: { 'type': 'string' },
                    customer_accepts_marketing: { 'type': 'boolean' },
                    customer_accepts_marketing_updated_at: { 'type': 'string' },
                    billing_first_name: { 'type': 'string' },
                    billing_last_name: { 'type': 'string' },
                    billing_phone: { 'type': 'string' },
                    billing_address1: { 'type': 'string' },
                    billing_city: { 'type': 'string' },
                    billing_country: { 'type': 'string' },
                    billing_province: { 'type': 'string' },
                    billing_zip: { 'type': 'string' },
                    shipping_first_name: { 'type': 'string' },
                    shipping_last_name: { 'type': 'string' },
                    shipping_phone: { 'type': 'string' },
                    shipping_address1: { 'type': 'string' },
                    shipping_city: { 'type': 'string' },
                    shipping_country: { 'type': 'string' },
                    shipping_province: { 'type': 'string' },
                    shipping_zip: { 'type': 'string' },
                    test: { 'type': 'boolean' },
                    generateInspector: { 'type': 'boolean' }
                },
                anyOf: [
                    { required: ['line_items', 'email'] },
                    { required: ['line_items', 'phone'] }
                ]
            },
            groups: {
                order_details: {
                    label: 'Order Details',
                    index: 1
                },
                discount: {
                    label: 'Discount',
                    index: 2
                },
                tax: {
                    label: 'Tax',
                    index: 3
                },
                note: {
                    label: 'Note',
                    index: 4
                },
                tags: {
                    label: 'Tags',
                    index: 5
                },
                customer: {
                    label: 'Customer Information',
                    index: 6
                },
                billing_address: {
                    label: 'Billing Address',
                    index: 7
                },
                shipping_address: {
                    label: 'Shipping Address',
                    index: 8
                }
            },
            inputs: {
                line_items: {
                    type: 'expression',
                    index: 1,
                    label: 'Line Items',
                    levels: ['ADD'],
                    tooltip: 'A list of line item objects, each containing information about an item in the order. You can either set Variant ID and quantity OR Title, Price and Quantity. You cannot mix them.',
                    group: 'order_details',
                    fields: {
                        variantType: {
                            type: 'select',
                            label: 'Item Type',
                            options: [
                                { value: 'variant', 'content': 'Variant' },
                                { value: 'custom', 'content': 'Custom' }
                            ],
                            defaultValue: 'variant',
                            index: 0
                        },
                        variant_id: {
                            type: 'select',
                            label: 'Variant ID',
                            options: products,
                            index: 1,
                            tooltip: 'The ID of the product variant.',
                            when: { eq: { './variantType': 'variant' } }
                        },
                        title: {
                            type: 'text',
                            label: 'Item Title',
                            index: 2,
                            tooltip: 'The title of the product variant.',
                            when: { eq: { './variantType': 'custom' } }
                        },
                        price: {
                            type: 'number',
                            label: 'Price Per Item',
                            index: 3,
                            tooltip: 'The price of the item before discounts have been applied in the shop currency.',
                            when: { eq: { './variantType': 'custom' } }
                        },
                        grams: {
                            type: 'number',
                            label: 'Weight',
                            index: 4,
                            tooltip: 'The weight of the item in grams.',
                            when: { eq: { './variantType': 'custom' } }
                        },
                        quantity: {
                            type: 'number',
                            label: 'Quantity',
                            index: 5,
                            tooltip: 'The number of items being purchased.'
                        },
                        taxable: {
                            type: 'toggle',
                            defaultValue: false,
                            label: 'Item is Taxable',
                            index: 6,
                            tooltip: 'Whether the item is taxable.',
                            when: { eq: { './variantType': 'custom' } }
                        },
                        requires_shipping: {
                            type: 'toggle',
                            defaultValue: false,
                            label: 'Item Requires Shipping',
                            index: 7,
                            tooltip: 'Whether the item requires shipping.',
                            when: { eq: { './variantType': 'custom' } }
                        }
                    }
                },
                email: {
                    type: 'text',
                    label: 'Email Address',
                    index: 2,
                    group: 'order_details',
                    tooltip: 'The customer\'s email address.'
                },
                phone: {
                    type: 'text',
                    label: 'Phone Number',
                    index: 3,
                    group: 'order_details',
                    tooltip: 'The customer\'s phone number for receiving SMS notifications.'
                },
                buyer_accepts_marketing: {
                    type: 'toggle',
                    group: 'order_details',
                    label: 'Customer accepts marketing',
                    defaultValue: false,
                    tooltip: 'Whether the customer has consented to receive marketing material via email.',
                    index: 4
                },
                financial_status: {
                    type: 'select',
                    group: 'order_details',
                    options: [
                        { value: 'authorized', 'content': 'Authorized' },
                        { value: 'pending', 'content': 'Pending' },
                        { value: 'paid', 'content': 'Paid' },
                        { value: 'partially_paid', 'content': 'Partially Paid' },
                        { value: 'refunded', 'content': 'Refunded' },
                        { value: 'voided', 'content': 'Voided' },
                        { value: 'partially_refunded', 'content': 'Partially Refunded' },
                        { value: 'unpaid', 'content': 'Unpaid' }
                    ],
                    defaultValue: 'pending',
                    tooltip: 'The status of payments associated with the order.',
                    label: 'Financial Status',
                    index: 5
                },
                fulfillment_status: {
                    type: 'select',
                    group: 'order_details',
                    options: [
                        { value: 'null', 'content': 'Null' },
                        { value: 'fulfilled', 'content': 'Fulfilled' },
                        { value: 'partial', 'content': 'Partial' },
                        { value: 'restocked', 'content': 'Restocked' }
                    ],
                    defaultValue: 'null',
                    tooltip: 'The order\'s status in terms of fulfilled line items.',
                    label: 'Fulfillment Status',
                    index: 6
                },
                currency: {
                    type: 'text',
                    label: 'Currency',
                    group: 'order_details',
                    index: 7,
                    tooltip: 'The three-letter code (ISO 4217 format) for the shop currency.'
                },
                discount_codes: {
                    type: 'expression',
                    index: 8,
                    label: 'Discount Codes',
                    levels: ['ADD'],
                    tooltip: 'A list of discount codes to apply to the order.',
                    group: 'discount',
                    fields: {
                        code: {
                            type: 'text',
                            label: 'Discount Code',
                            index: 1,
                            tooltip: 'The discount code.'
                        },
                        amount: {
                            type: 'number',
                            label: 'Discount Amount',
                            index: 2,
                            tooltip: 'The value of the discount to be deducted from the order total.'
                        },
                        type: {
                            type: 'select',
                            label: 'Type of Discount',
                            index: 3,
                            tooltip: 'The type of discount.',
                            options: [
                                { value: 'fixed_amount', 'content': 'Fixed Amount' },
                                { value: 'percentage', 'content': 'Percentage' },
                                { value: 'shipping', 'content': 'Shipping' }
                            ],
                            defaultValue: 'fixed_amount'
                        }
                    }
                },
                total_discounts: {
                    type: 'number',
                    label: 'Total Discounts',
                    index: 9,
                    group: 'discount',
                    tooltip: 'The total discounts applied to the price of the order in the shop currency.'
                },
                taxes_included: {
                    type: 'toggle',
                    group: 'tax',
                    label: 'Include taxes',
                    defaultValue: false,
                    tooltip: 'Whether taxes are included in the order subtotal',
                    index: 10
                },
                tax_lines: {
                    type: 'expression',
                    index: 11,
                    label: 'Tax Lines',
                    levels: ['ADD'],
                    tooltip: 'An list of tax lines, each of which details a tax applicable to the order',
                    group: 'tax',
                    fields: {
                        title: {
                            type: 'text',
                            label: 'Tax Name',
                            index: 1,
                            tooltip: 'The name of the tax.'
                        },
                        price: {
                            type: 'number',
                            label: 'Tax Amount',
                            index: 2,
                            tooltip: 'The amount of tax to be charged in the shop currency.'
                        },
                        rate: {
                            type: 'text',
                            label: 'Tax Rate',
                            index: 3,
                            tooltip: 'The rate of tax to be applied.'
                        }
                    }
                },
                note: {
                    type: 'textarea',
                    label: 'Note',
                    index: 12,
                    tooltip: 'An optional note that a shop owner can attach to the order',
                    group: 'note'
                },
                tags: {
                    type: 'text',
                    label: 'Tags (comma-separated values)',
                    index: 13,
                    tooltip: 'An optional note that a shop owner can attach to the order',
                    group: 'tags'
                },
                customer_id: {
                    type: 'text',
                    label: 'Customer ID',
                    source: {
                        url: '/component/appmixer/shopify/customers/ListCustomers?outPort=customers',
                        data: {
                            properties: { 'sendWholeArray': true },
                            transform: './ListCustomers#customersToSelectArray'
                        }
                    },
                    index: 14,
                    tooltip: 'The ID of the customer.',
                    group: 'customer'
                },
                customer_first_name: {
                    type: 'text',
                    label: 'First Name',
                    index: 15,
                    tooltip: 'First Name',
                    group: 'customer'
                },
                customer_last_name: {
                    type: 'text',
                    label: 'Last Name',
                    index: 16,
                    tooltip: 'Last Name',
                    group: 'customer'
                },
                customer_email: {
                    type: 'text',
                    label: 'Email Address',
                    index: 17,
                    tooltip: 'Email Address',
                    group: 'customer'
                },
                customer_phone: {
                    type: 'text',
                    label: 'Phone Number',
                    index: 18,
                    tooltip: 'Phone Number',
                    group: 'customer'
                },
                customer_accepts_marketing: {
                    type: 'toggle',
                    group: 'customer',
                    label: 'Customer accepts marketing',
                    defaultValue: false,
                    tooltip: 'Whether the customer has consented to receive marketing material via email.',
                    index: 19
                },
                customer_accepts_marketing_updated_at: {
                    type: 'date-time',
                    group: 'customer',
                    tooltip: 'The date and time when the customer consented or objected to receiving marketing material by email',
                    label: 'Marketing Opt-in Date',
                    index: 20
                },
                billing_first_name: {
                    type: 'text',
                    label: 'First Name',
                    index: 21,
                    tooltip: 'First Name',
                    group: 'billing_address'
                },
                billing_last_name: {
                    type: 'text',
                    label: 'Last Name',
                    index: 22,
                    tooltip: 'Last Name',
                    group: 'billing_address'
                },
                billing_phone: {
                    type: 'text',
                    label: 'Phone Number',
                    index: 23,
                    tooltip: 'Phone Number',
                    group: 'billing_address'
                },
                billing_address1: {
                    type: 'textarea',
                    label: 'Address',
                    index: 24,
                    tooltip: 'Address',
                    group: 'billing_address'
                },
                billing_city: {
                    type: 'text',
                    label: 'City',
                    index: 24,
                    tooltip: 'City',
                    group: 'billing_address'
                },
                billing_province: {
                    type: 'text',
                    label: 'State/Province (in ISO format)',
                    index: 25,
                    tooltip: 'State/Province (in ISO format). Example: ON, AB, ...',
                    group: 'billing_address'
                },
                billing_country: {
                    type: 'text',
                    label: 'Country (in ISO format)',
                    index: 26,
                    tooltip: 'Country (in ISO format). Example: CZ, SK, ...',
                    group: 'billing_address'
                },
                billing_zip: {
                    type: 'text',
                    label: 'Postal Code',
                    index: 27,
                    tooltip: 'Postal Code',
                    group: 'billing_address'
                },
                shipping_first_name: {
                    type: 'text',
                    label: 'First Name',
                    index: 28,
                    tooltip: 'First Name',
                    group: 'shipping_address'
                },
                shipping_last_name: {
                    type: 'text',
                    label: 'Last Name',
                    index: 29,
                    tooltip: 'Last Name',
                    group: 'shipping_address'
                },
                shipping_phone: {
                    type: 'text',
                    label: 'Phone Number',
                    index: 30,
                    tooltip: 'Phone Number',
                    group: 'shipping_address'
                },
                shipping_address1: {
                    type: 'textarea',
                    label: 'Address',
                    index: 31,
                    tooltip: 'Address',
                    group: 'shipping_address'
                },
                shipping_city: {
                    type: 'text',
                    label: 'City',
                    index: 32,
                    tooltip: 'City',
                    group: 'shipping_address'
                },
                shipping_province: {
                    type: 'text',
                    label: 'State/Province (in ISO format)',
                    index: 33,
                    tooltip: 'State/Province (in ISO format). Example: ON, AB, ...',
                    group: 'shipping_address'
                },
                shipping_country: {
                    type: 'text',
                    label: 'Country (in ISO format)',
                    index: 35,
                    tooltip: 'Country (in ISO format). Example: CZ, SK, ...',
                    group: 'shipping_address'
                },
                shipping_zip: {
                    type: 'text',
                    label: 'Postal Code',
                    index: 36,
                    tooltip: 'Postal Code',
                    group: 'shipping_address'
                },
                test: {
                    type: 'toggle',
                    defaultValue: false,
                    label: 'Test Order',
                    index: 36,
                    tooltip: 'Whether this is a test order.',
                    group: 'order_details'
                }
            }
        };
    }
};

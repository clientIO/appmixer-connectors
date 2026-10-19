'use strict';

const assert = require('assert');
const SCHEMAS = require('../../item-schema-orders.json');
const FindOrders = require('../../orders/FindOrders/FindOrders');
const CreateOrder = require('../../orders/CreateOrder/CreateOrder');
const UpdateOrder = require('../../orders/UpdateOrder/UpdateOrder');

const component = name => require(`../../orders/${name}/component.json`);

// Static out ports that carry one of the item schemas; triggers add the topic.
const STATIC_PORTS = {
    GetOrder: ['order', null],
    CreateOrder: ['order', null],
    NewOrder: ['order', 'orders/create'],
    UpdatedOrder: ['order', 'orders/updated'],
    CancelledOrder: ['order', 'orders/cancelled'],
    FulfilledOrder: ['order', 'orders/fulfilled'],
    NewPaidOrder: ['order', 'orders/paid'],
    NewRefund: ['refund', 'refunds/create'],
    NewFulfillment: ['fulfillment', 'fulfillments/create'],
    UpdatedFulfillment: ['fulfillment', 'fulfillments/update']
};

// Every nested title must be prefixed with its parent's (array items excepted).
function checkTitles(schema, parent, path, problems) {

    for (const [key, prop] of Object.entries(schema.properties || {})) {
        const where = `${path}.${key}`;
        if (!prop.title) problems.push(`${where}: no title`);
        else if (parent && !prop.title.startsWith(`${parent}.`)) problems.push(`${where}: "${prop.title}" not prefixed with "${parent}."`);
        if (prop.type === 'object') checkTitles(prop, prop.title, where, problems);
        else if (!('example' in prop)) problems.push(`${where}: no example`);
        if (prop.type === 'array' && prop.items && prop.items.type === 'object') checkTitles(prop.items, null, `${where}[]`, problems);
    }
    for (const key of schema.required || []) {
        if (!(schema.properties || {})[key]) problems.push(`${path}: required ${key} is not a property`);
    }
    return problems;
}

describe('Shopify orders components (4.0)', () => {

    describe('output schemas', () => {

        for (const key of ['order', 'refund', 'fulfillment']) {
            it(`should give the ${key} schema titles, prefixes and examples`, () => {
                assert.strictEqual(SCHEMAS[key].type, 'object');
                assert.deepStrictEqual(checkTitles(SCHEMAS[key], null, key, []), []);
            });
        }

        it('should export the order schema as ITEM_SCHEMA of Find Orders', () => {
            assert.strictEqual(FindOrders.ITEM_SCHEMA, SCHEMAS.order);
            const port = component('FindOrders').outPorts.find(p => p.name === 'out');
            assert.ok(port.source, 'Find Orders out port is dynamic');
            assert.ok(component('FindOrders').outPorts.find(p => p.name === 'notFound'));
        });

        for (const [name, [key, topic]] of Object.entries(STATIC_PORTS)) {
            it(`should give ${name} the ${key} schema${topic ? ' plus the webhook topic' : ''}`, () => {
                const port = component(name).outPorts.find(p => p.name === 'out');
                const schema = JSON.parse(JSON.stringify(port.schema));
                if (topic) {
                    assert.strictEqual(schema.properties.webhookTopic.example, topic);
                    delete schema.properties.webhookTopic;
                    schema.required = schema.required.filter(field => field !== 'webhookTopic');
                }
                assert.deepStrictEqual(schema, SCHEMAS[key]);
            });
        }

        it('should give Deleted Order the id and the topic only', () => {
            const port = component('DeletedOrder').outPorts.find(p => p.name === 'out');
            assert.deepStrictEqual(Object.keys(port.schema.properties), ['id', 'webhookTopic']);
        });
    });

    describe('Find Orders', () => {

        it('should turn the picker listing into select options', () => {
            const options = FindOrders.ordersToSelectArray({ result: [
                { id: 'gid://shopify/Order/1', name: '#1001', email: 'jane@example.com', totalPriceSet: { shopMoney: { amount: '9.99', currencyCode: 'USD' } } },
                { id: 'gid://shopify/Order/2', name: '#1002', email: null, totalPriceSet: null }
            ] });
            assert.deepStrictEqual(options, [
                { label: '#1001 (jane@example.com, 9.99 USD)', value: 'gid://shopify/Order/1' },
                { label: '#1002', value: 'gid://shopify/Order/2' }
            ]);
            assert.deepStrictEqual(FindOrders.ordersToSelectArray(undefined), []);
        });
    });

    describe('Create Order input', () => {

        it('should build OrderCreateOrderInput from the inputs', () => {
            const inputs = {
                lineItems: { ADD: [
                    { itemType: 'variant', variantId: '62788973297745', quantity: '2' },
                    { itemType: 'custom', title: 'Gift wrap', price: 2.5, quantity: 1, sku: 'GW', taxable: false, requiresShipping: false }
                ] },
                email: 'jane@example.com', phone: '', note: 'Thanks', tags: 'vip, e2e', poNumber: 'PO-1',
                financialStatus: 'pending', test: true, taxesIncluded: false,
                customerFirstName: 'Jane', customerEmail: 'jane@example.com',
                billingFirstName: 'Jane', billingCountryCode: 'cz', billingCity: 'Prague',
                shippingAddress1: '100 Queen St W', shippingProvinceCode: 'on', shippingCountryCode: 'CA',
                discountCode: 'SPRING', discountType: 'PERCENTAGE', discountValue: 10,
                taxLines: { ADD: [{ title: 'VAT', rate: 0.21, price: 2.1 }, { title: '', rate: '' }] }
            };
            assert.strictEqual(CreateOrder.needsCurrency(inputs), true);
            assert.deepStrictEqual(CreateOrder.toOrderInput(inputs, 'USD'), {
                lineItems: [
                    { quantity: 2, variantId: 'gid://shopify/ProductVariant/62788973297745' },
                    { quantity: 1, title: 'Gift wrap', priceSet: { shopMoney: { amount: '2.5', currencyCode: 'USD' } }, sku: 'GW', taxable: false, requiresShipping: false }
                ],
                email: 'jane@example.com', note: 'Thanks', poNumber: 'PO-1', financialStatus: 'PENDING',
                tags: ['vip', 'e2e'], test: true, taxesIncluded: false,
                customer: { toUpsert: { email: 'jane@example.com', firstName: 'Jane' } },
                billingAddress: { firstName: 'Jane', city: 'Prague', countryCode: 'CZ' },
                shippingAddress: { address1: '100 Queen St W', provinceCode: 'ON', countryCode: 'CA' },
                discountCode: { itemPercentageDiscountCode: { code: 'SPRING', percentage: 10 } },
                taxLines: [{ title: 'VAT', rate: '0.21', priceSet: { shopMoney: { amount: '2.1', currencyCode: 'USD' } } }]
            });
        });

        it('should associate an existing customer and build fixed / free shipping codes', () => {
            const base = { lineItems: [{ itemType: 'variant', variantId: 'gid://shopify/ProductVariant/1' }], customerId: '27606881304657', customerEmail: 'ignored@example.com' };
            const fixed = CreateOrder.toOrderInput({ ...base, discountCode: 'TEN', discountValue: '10' }, 'EUR');
            assert.deepStrictEqual(fixed.customer, { toAssociate: { id: 'gid://shopify/Customer/27606881304657' } });
            assert.deepStrictEqual(fixed.lineItems, [{ quantity: 1, variantId: 'gid://shopify/ProductVariant/1' }]);
            assert.deepStrictEqual(fixed.discountCode, { itemFixedDiscountCode: { code: 'TEN', amountSet: { shopMoney: { amount: '10', currencyCode: 'EUR' } } } });
            const free = CreateOrder.toOrderInput({ ...base, discountCode: 'SHIP', discountType: 'FREE_SHIPPING' });
            assert.deepStrictEqual(free.discountCode, { freeShippingDiscountCode: { code: 'SHIP' } });
            assert.strictEqual(CreateOrder.needsCurrency({ ...base, discountCode: 'SHIP', discountType: 'FREE_SHIPPING' }), false);
        });

        it('should reject incomplete line items and tax lines', () => {
            assert.throws(() => CreateOrder.toOrderInput({ lineItems: [] }), /at least one line item/);
            assert.throws(() => CreateOrder.toOrderInput({ lineItems: [{ itemType: 'variant' }] }), /choose a product variant/);
            assert.throws(() => CreateOrder.toOrderInput({ lineItems: [{ itemType: 'custom', price: 1 }] }), /needs a title/);
            assert.throws(() => CreateOrder.toOrderInput({ lineItems: [{ itemType: 'custom', title: 'x', price: 'abc' }] }, 'USD'), /price must be a number/);
            assert.throws(() => CreateOrder.toOrderInput({ lineItems: [{ variantId: '1' }], taxLines: [{ title: 'VAT' }] }), /Tax line 1 needs a title and a rate/);
            assert.throws(() => CreateOrder.toOrderInput({ lineItems: [{ variantId: '1' }], billingCountryCode: 'Czechia' }), /Billing Country Code/);
        });
    });

    describe('triggers', function() {

        // Requests are spaced by the connector's throttle (~500 ms each).
        this.timeout(10000);

        // A trigger context receiving one webhook delivery; GraphQL answers by operation name.
        function webhookContext(payload, answers, config = {}) {

            const sent = [];
            const cache = new Map();
            return {
                sent,
                context: {
                    componentId: 'trigger-1',
                    config,
                    auth: { store: 'appmixerqa-hapres7r', accessToken: 'token' },
                    messages: { webhook: { content: {
                        headers: { 'x-shopify-topic': payload.topic, 'x-shopify-event-id': payload.eventId || 'event-1' },
                        data: payload.data
                    } } },
                    staticCache: { get: async key => cache.get(key), set: async (key, value) => cache.set(key, value) },
                    httpRequest: async ({ data }) => {
                        const name = data.query.match(/(?:query|mutation) (\w+)/)[1];
                        return { data: { data: answers[name](data.variables) }, headers: {} };
                    },
                    sendJson: async (content, port) => sent.push({ content, port }),
                    response: () => 'ok',
                    CancelError: Error
                }
            };
        }

        const node = (createdAt, updatedAt) => ({
            id: 'gid://shopify/Order/5', createdAt, updatedAt,
            shippingLines: { nodes: [] }, discountApplications: { nodes: [] },
            lineItems: { nodes: [], pageInfo: { hasNextPage: false } }, fulfillments: [], refunds: [], transactions: []
        });

        it('Updated Order should skip the update that is part of the creation', async () => {
            const UpdatedOrder = require('../../orders/UpdatedOrder/UpdatedOrder');
            const created = webhookContext(
                { topic: 'orders/updated', data: { id: 5, admin_graphql_api_id: 'gid://shopify/Order/5' } },
                { GetOrder: () => ({ order: node('2026-10-05T08:24:35Z', '2026-10-05T08:24:36Z') }) });
            await UpdatedOrder.receive(created.context);
            assert.deepStrictEqual(created.sent, []);

            const updated = webhookContext(
                { topic: 'orders/updated', data: { id: 5 } },
                { GetOrder: variables => ({ order: { ...node('2026-10-05T08:24:35Z', '2026-10-05T08:30:00Z'), id: variables.id } }) });
            await UpdatedOrder.receive(updated.context);
            assert.strictEqual(updated.sent.length, 1);
            assert.strictEqual(updated.sent[0].port, 'out');
            assert.strictEqual(updated.sent[0].content.id, 'gid://shopify/Order/5');
            assert.strictEqual(updated.sent[0].content.webhookTopic, 'orders/updated');
            assert.deepStrictEqual(updated.sent[0].content.lineItems, []);
        });

        it('Deleted Order should emit the gid without reading the order', async () => {
            const DeletedOrder = require('../../orders/DeletedOrder/DeletedOrder');
            const { context, sent } = webhookContext({ topic: 'orders/delete', data: { id: 17292422217809 } }, {});
            await DeletedOrder.receive(context);
            assert.deepStrictEqual(sent, [{ content: { id: 'gid://shopify/Order/17292422217809', webhookTopic: 'orders/delete' }, port: 'out' }]);
        });

        it('New Refund should emit the refund read through GraphQL', async () => {
            const NewRefund = require('../../orders/NewRefund/NewRefund');
            const { context, sent } = webhookContext(
                { topic: 'refunds/create', data: { id: 1221986910289, admin_graphql_api_id: 'gid://shopify/Refund/1221986910289' } },
                { GetRefund: variables => ({ refund: {
                    id: variables.id, refundLineItems: { nodes: [] }, transactions: { nodes: [] },
                    orderAdjustments: { nodes: [] },
                    order: { id: 'gid://shopify/Order/5', legacyResourceId: '5', name: '#1005' }
                } }) });
            await NewRefund.receive(context);
            assert.strictEqual(sent[0].content.id, 'gid://shopify/Refund/1221986910289');
            assert.strictEqual(sent[0].content.order.name, '#1005');
            assert.strictEqual(sent[0].content.webhookTopic, 'refunds/create');
        });
    });

    describe('Update Order input', () => {

        it('should send only the filled fields', () => {
            assert.deepStrictEqual(UpdateOrder.toOrderInput({
                id: 'gid://shopify/Order/5', email: '', note: 'New note', tags: 'a,b', poNumber: 'PO-2',
                shippingCity: 'Brno', shippingCountryCode: 'cz', shippingZip: '602 00'
            }), {
                id: 'gid://shopify/Order/5', note: 'New note', poNumber: 'PO-2', tags: ['a', 'b'],
                shippingAddress: { city: 'Brno', countryCode: 'CZ', zip: '602 00' }
            });
            assert.deepStrictEqual(UpdateOrder.toOrderInput({ id: ' 5 ' }), { id: '5' });
        });
    });
});

'use strict';

const assert = require('assert');
const gqlOrders = require('../../gql-orders');

const usd = amount => ({ shopMoney: { amount, currencyCode: 'USD' } });

// An order as the GraphQL Admin API 2026-10 returned it (probe order #1026,
// trimmed), before its connections are flattened.
function orderNode(overrides = {}) {

    return {
        id: 'gid://shopify/Order/17292422217809', legacyResourceId: '17292422217809', name: '#1026', number: 1026,
        email: 'gql4-probe.order@example.com', tags: ['e2e', 'gql4-probe'], createdAt: '2026-10-05T08:24:35Z',
        updatedAt: '2026-10-05T08:24:35Z', displayFinancialStatus: 'PAID', displayFulfillmentStatus: 'UNFULFILLED',
        totalPriceSet: usd('908.05'),
        shippingLines: { nodes: [] },
        discountApplications: { nodes: [{
            type: 'ManualDiscountApplication', allocationMethod: 'ACROSS', targetSelection: 'ALL', targetType: 'LINE_ITEM',
            value: { type: 'MoneyV2', amount: '5.0', currencyCode: 'USD' }, title: 'GQL4PROBE5', description: 'GQL4PROBE5'
        }] },
        lineItems: {
            nodes: [{ id: 'gid://shopify/LineItem/46373199282257', name: 'The Minimal Snowboard', quantity: 1 }],
            pageInfo: { hasNextPage: false, endCursor: 'c1' }
        },
        fulfillments: [{ id: 'gid://shopify/Fulfillment/9268311720017', name: '#1026-F1', status: 'SUCCESS', trackingInfo: [] }],
        refunds: [],
        transactions: [],
        ...overrides
    };
}

// `run` mock: records each call and answers by operation name.
function mockRun(answers) {

    const calls = [];
    const run = async (query, variables) => {
        const name = query.match(/(?:query|mutation) (\w+)/)[1];
        calls.push({ name, query, variables });
        const answer = answers[name];
        if (!answer) throw new Error(`Unexpected operation ${name}`);
        return typeof answer === 'function' ? answer(variables, calls) : answer;
    };
    return { run, calls };
}

describe('Shopify GraphQL orders (4.0)', () => {

    describe('flatten', () => {

        it('should turn the order connections into arrays and keep everything else', () => {
            const order = gqlOrders.flattenOrder(orderNode());
            assert.strictEqual(order.id, 'gid://shopify/Order/17292422217809');
            assert.strictEqual(order.legacyResourceId, '17292422217809');
            assert.deepStrictEqual(order.tags, ['e2e', 'gql4-probe']);
            assert.deepStrictEqual(order.totalPriceSet, usd('908.05'));
            assert.deepStrictEqual(order.shippingLines, []);
            assert.strictEqual(order.discountApplications[0].title, 'GQL4PROBE5');
            assert.deepStrictEqual(order.lineItems, [{ id: 'gid://shopify/LineItem/46373199282257', name: 'The Minimal Snowboard', quantity: 1 }]);
            assert.strictEqual(order.fulfillments[0].name, '#1026-F1');
        });

        it('should flatten refunds and fulfillments', () => {
            const refund = gqlOrders.flattenRefund({
                id: 'gid://shopify/Refund/1',
                refundLineItems: { nodes: [{ quantity: 1 }] },
                transactions: { nodes: [{ kind: 'REFUND' }] },
                orderAdjustments: { nodes: [] }
            });
            assert.deepStrictEqual(refund.refundLineItems, [{ quantity: 1 }]);
            assert.deepStrictEqual(refund.transactions, [{ kind: 'REFUND' }]);
            assert.deepStrictEqual(refund.orderAdjustments, []);
            const fulfillment = gqlOrders.flattenFulfillment({ id: 'gid://shopify/Fulfillment/1', lineItems: { nodes: [{ quantity: 2 }] } });
            assert.deepStrictEqual(fulfillment.lineItems, [{ quantity: 2 }]);
            assert.strictEqual(gqlOrders.flattenOrder(null), null);
        });
    });

    describe('searchQuery', () => {

        it('should return null when nothing is filtered', () => {
            assert.strictEqual(gqlOrders.searchQuery({}), null);
            assert.strictEqual(gqlOrders.searchQuery({ status: 'any', financialStatus: 'any', fulfillmentStatus: '' }), null);
        });

        it('should combine the query with the typed filters', () => {
            const query = gqlOrders.searchQuery({
                query: 'tag:wholesale',
                status: 'open',
                financialStatus: 'partially_refunded',
                fulfillmentStatus: 'shipped',
                customerId: 'gid://shopify/Customer/27606881304657',
                createdAtMin: '2026-10-01T00:00:00Z',
                createdAtMax: '2026-10-05',
                updatedAtMin: '2026-10-02T10:00:00+02:00'
            });
            assert.strictEqual(query, [
                '(tag:wholesale)', 'status:open', 'financial_status:partially_refunded', 'fulfillment_status:shipped',
                'customer_id:27606881304657', 'created_at:>=\'2026-10-01T00:00:00.000Z\'',
                'created_at:<=\'2026-10-05T00:00:00.000Z\'', 'updated_at:>=\'2026-10-02T08:00:00.000Z\''
            ].join(' AND '));
        });

        it('should expand unpaid', () => {
            assert.strictEqual(gqlOrders.searchQuery({ financialStatus: 'unpaid' }),
                '(financial_status:authorized OR financial_status:pending OR financial_status:partially_paid)');
        });

        it('should reject values that are not filters (no query injection)', () => {
            assert.throws(() => gqlOrders.searchQuery({ status: 'open OR tag:x' }), /Unsupported order status/);
            assert.throws(() => gqlOrders.searchQuery({ financialStatus: 'paid OR x' }), /Unsupported financial status/);
            assert.throws(() => gqlOrders.searchQuery({ customerId: '1 OR id:2' }), /numeric id/);
            assert.throws(() => gqlOrders.searchQuery({ createdAtMin: 'yesterday\' OR x' }), /must be a date/);
        });
    });

    describe('mailingAddress', () => {

        it('should keep the filled fields and upper-case the codes', () => {
            assert.deepStrictEqual(gqlOrders.mailingAddress({
                firstName: 'Jane', lastName: ' Doe ', address1: '100 Queen St W', address2: '', city: 'Toronto',
                provinceCode: 'on', countryCode: 'ca', zip: 'M5H 2N2'
            }), {
                firstName: 'Jane', lastName: 'Doe', address1: '100 Queen St W', city: 'Toronto',
                provinceCode: 'ON', countryCode: 'CA', zip: 'M5H 2N2'
            });
            assert.strictEqual(gqlOrders.mailingAddress({ city: '' }), undefined);
        });

        it('should reject country and province names', () => {
            assert.throws(() => gqlOrders.mailingAddress({ countryCode: 'Canada' }, 'Billing'), /Billing Country Code must be a two-letter/);
            assert.throws(() => gqlOrders.mailingAddress({ provinceCode: 'Ontario' }), /Province Code/);
        });
    });

    describe('api', () => {

        it('get should query by gid and return the flattened order', async () => {
            const { run, calls } = mockRun({ GetOrder: { order: orderNode() } });
            const order = await gqlOrders(run).get('17292422217809');
            assert.strictEqual(calls[0].variables.id, 'gid://shopify/Order/17292422217809');
            assert.ok(Array.isArray(order.lineItems));
            assert.ok(Array.isArray(order.discountApplications));
        });

        it('get should throw 404 and fetch should return null for a missing order', async () => {
            const { run } = mockRun({ GetOrder: { order: null } });
            await assert.rejects(() => gqlOrders(run).get('1'), err => err.statusCode === 404);
            assert.strictEqual(await gqlOrders(run).fetch('1'), null);
        });

        it('get should fetch the remaining line items of a large order', async () => {
            const { run, calls } = mockRun({
                GetOrder: { order: orderNode({ lineItems: { nodes: [{ id: 'l1' }], pageInfo: { hasNextPage: true, endCursor: 'c1' } } }) },
                OrderLineItems: variables => ({ order: { lineItems: variables.after === 'c1'
                    ? { nodes: [{ id: 'l2' }], pageInfo: { hasNextPage: true, endCursor: 'c2' } }
                    : { nodes: [{ id: 'l3' }], pageInfo: { hasNextPage: false, endCursor: null } } } })
            });
            const order = await gqlOrders(run).get('1');
            assert.deepStrictEqual(order.lineItems.map(item => item.id), ['l1', 'l2', 'l3']);
            assert.deepStrictEqual(calls.map(call => call.name), ['GetOrder', 'OrderLineItems', 'OrderLineItems']);
        });

        it('find should page up to max with the query and sort', async () => {
            const { run, calls } = mockRun({
                FindOrders: variables => ({ orders: {
                    nodes: Array.from({ length: variables.first }, (v, i) => orderNode({ id: `${variables.after || 'p1'}-${i}` })),
                    pageInfo: { hasNextPage: true, endCursor: 'next' }
                } })
            });
            const orders = await gqlOrders(run).find({ query: 'status:open', sortKey: 'updated_at', reverse: true, max: 150 });
            assert.strictEqual(orders.length, 150);
            assert.deepStrictEqual(calls.map(call => call.variables.first), [100, 50]);
            assert.deepStrictEqual(calls[0].variables, { first: 100, after: null, query: 'status:open', sortKey: 'UPDATED_AT', reverse: true });
            assert.strictEqual(calls[1].variables.after, 'next');
        });

        it('find should default to 250 orders by creation date and reject unknown sorts', async () => {
            const { run, calls } = mockRun({ FindOrders: { orders: { nodes: [], pageInfo: { hasNextPage: false } } } });
            assert.deepStrictEqual(await gqlOrders(run).find(), []);
            assert.deepStrictEqual(calls[0].variables, { first: 100, after: null, query: null, sortKey: 'CREATED_AT', reverse: false });
            await assert.rejects(() => gqlOrders(run).find({ sortKey: 'price desc' }), /Unsupported sort/);
        });

        it('count should send the query', async () => {
            const { run, calls } = mockRun({ CountOrders: { ordersCount: { count: 7 } } });
            assert.strictEqual(await gqlOrders(run).count('status:open'), 7);
            assert.deepStrictEqual(calls[0].variables, { query: 'status:open' });
        });

        it('create should send the input and options and return the re-read order', async () => {
            const { run, calls } = mockRun({
                CreateOrder: { orderCreate: { order: { id: 'gid://shopify/Order/5' }, userErrors: [] } },
                GetOrder: { order: orderNode({ id: 'gid://shopify/Order/5' }) }
            });
            const order = await gqlOrders(run).create({ lineItems: [{ quantity: 1, variantId: 'gid://shopify/ProductVariant/1' }] }, { sendReceipt: false });
            assert.strictEqual(order.id, 'gid://shopify/Order/5');
            assert.deepStrictEqual(calls[0].variables.options, { sendReceipt: false });
            assert.strictEqual(calls[1].variables.id, 'gid://shopify/Order/5');
        });

        it('create should turn userErrors into a 422', async () => {
            const { run } = mockRun({
                CreateOrder: { orderCreate: { order: null, userErrors: [{ field: ['order', 'lineItems'], message: 'is invalid' }] } }
            });
            await assert.rejects(() => gqlOrders(run).create({ lineItems: [] }),
                err => err.statusCode === 422 && /order\.lineItems: is invalid/.test(err.message));
        });

        it('update should send OrderInput with a gid', async () => {
            const { run, calls } = mockRun({ UpdateOrder: { orderUpdate: { order: { id: 'gid://shopify/Order/5' }, userErrors: [] } } });
            assert.strictEqual(await gqlOrders(run).update({ id: '5', note: 'x' }), undefined);
            assert.deepStrictEqual(calls[0].variables.input, { id: 'gid://shopify/Order/5', note: 'x' });
        });

        it('delete should map NOT_FOUND to 404', async () => {
            const ok = mockRun({ DeleteOrder: { orderDelete: { deletedId: 'gid://shopify/Order/5', userErrors: [] } } });
            await gqlOrders(ok.run).delete('5');
            assert.strictEqual(ok.calls[0].variables.orderId, 'gid://shopify/Order/5');
            const missing = mockRun({ DeleteOrder: { orderDelete: { deletedId: null, userErrors: [{ field: ['orderId'], message: 'Order does not exist', code: 'NOT_FOUND' }] } } });
            await assert.rejects(() => gqlOrders(missing.run).delete('5'), err => err.statusCode === 404);
        });

        it('fetchRefund / fetchFulfillment should return the flattened node or null', async () => {
            const { run, calls } = mockRun({
                GetRefund: variables => ({ refund: variables.id.endsWith('/1') ? {
                    id: variables.id, refundLineItems: { nodes: [] }, transactions: { nodes: [] },
                    orderAdjustments: { nodes: [] },
                    order: { id: 'gid://shopify/Order/5', legacyResourceId: '5', name: '#1005' }
                } : null }),
                GetFulfillment: { fulfillment: { id: 'gid://shopify/Fulfillment/2', lineItems: { nodes: [{ quantity: 1 }] } } }
            });
            const api = gqlOrders(run);
            const refund = await api.fetchRefund('1');
            assert.strictEqual(refund.order.name, '#1005');
            assert.deepStrictEqual(refund.refundLineItems, []);
            assert.strictEqual(await api.fetchRefund('9'), null);
            assert.deepStrictEqual((await api.fetchFulfillment('2')).lineItems, [{ quantity: 1 }]);
            assert.strictEqual(calls[0].variables.id, 'gid://shopify/Refund/1');
            assert.strictEqual(calls[2].variables.id, 'gid://shopify/Fulfillment/2');
        });

        it('latestFulfillment should pick the newest by the given date', async () => {
            const { run, calls } = mockRun({
                RecentOrderChildren: { orders: { nodes: [
                    { refunds: [], fulfillments: [{ id: 'f1', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-04T00:00:00Z' }] },
                    { refunds: [], fulfillments: [{ id: 'f2', createdAt: '2026-10-02T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' }] }
                ] } },
                GetFulfillment: variables => ({ fulfillment: { id: variables.id, lineItems: { nodes: [] } } })
            });
            const api = gqlOrders(run);
            assert.strictEqual((await api.latestFulfillment('createdAt')).id, 'gid://shopify/Fulfillment/f2');
            assert.strictEqual((await api.latestFulfillment('updatedAt')).id, 'gid://shopify/Fulfillment/f1');
            assert.strictEqual(await api.latestRefund(), null);
            assert.strictEqual(calls.filter(call => call.name === 'GetFulfillment').length, 2);
        });
    });
});

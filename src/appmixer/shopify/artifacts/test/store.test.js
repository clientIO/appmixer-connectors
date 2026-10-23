const assert = require('assert');
const lib = require('../../lib');
const gqlStore = require('../../gql-store');
const ITEM_SCHEMAS = require('../../item-schema-store.json');

class CancelError extends Error {}

// Objects as the GraphQL Admin API 2026-10 returns them (recorded on the QA
// store, connections still as { nodes }).
const MONEY = { shopMoney: { amount: '693.45', currencyCode: 'USD' } };
const CHECKOUT = {
    id: 'gid://shopify/AbandonedCheckout/72420962140241', name: '#72420962140241',
    abandonedCheckoutUrl: 'https://appmixerqa-hapres7r.myshopify.com/107961745489/checkouts/ac/x/recover?key=y',
    createdAt: '2026-10-02T13:27:33Z', updatedAt: '2026-10-02T23:28:00Z', completedAt: null, note: '',
    taxesIncluded: false, discountCodes: [], customAttributes: [],
    subtotalPriceSet: MONEY, totalDiscountSet: MONEY, totalLineItemsPriceSet: MONEY, totalTaxSet: MONEY,
    totalPriceSet: MONEY,
    customer: { id: 'gid://shopify/Customer/27598980087889', legacyResourceId: '27598980087889', displayName: 'Jane Doe', defaultEmailAddress: null, defaultPhoneNumber: null },
    shippingAddress: null, billingAddress: null,
    lineItems: { nodes: [{ id: 'gid://shopify/AbandonedCheckoutLineItem/ee01', title: 'Snowboard', quantity: 1 }] }
};
const DRAFT_ORDER = {
    id: 'gid://shopify/DraftOrder/1698576236625', legacyResourceId: '1698576236625', name: '#D14', status: 'OPEN',
    createdAt: '2026-10-02T15:26:06Z', updatedAt: '2026-10-02T15:27:07Z',
    lineItems: { nodes: [{ id: 'gid://shopify/DraftOrderLineItem/59738255294545', title: 'Appmixer E2E Draft Item', quantity: 1 }] }
};
const LEVEL_ID = 'gid://shopify/InventoryLevel/164439392337?inventory_item_id=64806874841169';
const LEVEL = {
    id: LEVEL_ID, isActive: true, createdAt: '2026-10-02T10:36:04Z', updatedAt: '2026-10-02T10:36:04Z',
    quantities: [{ name: 'available', quantity: 0 }],
    item: { id: 'gid://shopify/InventoryItem/64806874841169', legacyResourceId: '64806874841169', sku: null, tracked: false, variants: { nodes: [{ id: 'gid://shopify/ProductVariant/1' }] } },
    location: { id: 'gid://shopify/Location/124679880785', legacyResourceId: '124679880785', name: 'Shop location' }
};
const RETURN = {
    id: 'gid://shopify/Return/14381973585', name: '#1018-R1', status: 'OPEN', totalQuantity: 1, createdAt: '2026-10-03T09:00:00Z',
    order: { id: 'gid://shopify/Order/7801814876320', legacyResourceId: '7801814876320', name: '#1018' },
    returnLineItems: { nodes: [{ id: 'gid://shopify/ReturnLineItem/22573695185', quantity: 1 }] },
    reverseFulfillmentOrders: { nodes: [{ id: 'gid://shopify/ReverseFulfillmentOrder/12960858257', status: 'OPEN' }] }
};

function mockRun(handler) {

    const calls = [];
    const run = async (query, variables) => {
        calls.push({ query, variables });
        return handler(query, variables, calls.length - 1);
    };
    return { run, calls };
}

// Trigger context: lib.runner is stubbed, state and the static cache are in memory.
function mockContext(handler, { webhook, properties = {}, state = {} } = {}) {

    const { run, calls } = mockRun(handler);
    const cache = new Map();
    const context = {
        auth: { store: 'test-store', accessToken: 'shpat_test' },
        componentId: 'component-1',
        properties,
        messages: webhook ? { webhook: { content: webhook } } : {},
        CancelError,
        calls,
        sent: [],
        state,
        staticCache: {
            get: async key => cache.get(key),
            set: async (key, value) => cache.set(key, value)
        },
        async loadState() {
            return context.state;
        },
        async saveState(state) {
            context.state = state;
        },
        async sendJson(payload, port) {
            context.sent.push({ payload, port });
        },
        response() {
            return 'ack';
        }
    };
    lib.runner = () => run;
    return context;
}

describe('Shopify store resources (GraphQL)', () => {

    const originalRunner = lib.runner;
    afterEach(() => {
        lib.runner = originalRunner;
    });

    describe('gql-store', () => {

        it('should flatten the line items of a checkout and return null for other nodes', async () => {
            let node = CHECKOUT;
            const { run, calls } = mockRun(() => ({ node }));
            const checkout = await gqlStore(run).getCheckout(72420962140241);
            assert.deepStrictEqual(calls[0].variables, { id: CHECKOUT.id });
            assert.deepStrictEqual(checkout.lineItems, CHECKOUT.lineItems.nodes);

            node = {};
            assert.strictEqual(await gqlStore(run).getCheckout('gid://shopify/AbandonedCheckout/1'), null);
            node = null;
            assert.strictEqual(await gqlStore(run).getCheckout(1), null);
        });

        it('should page abandoned checkouts up to max', async () => {
            const { run, calls } = mockRun((query, { first, after }) => ({
                abandonedCheckouts: {
                    nodes: [CHECKOUT, CHECKOUT].slice(0, first),
                    pageInfo: { hasNextPage: true, endCursor: after ? 'c2' : 'c1' }
                }
            }));
            const checkouts = await gqlStore(run).listCheckouts({ max: 3 });
            assert.strictEqual(checkouts.length, 3);
            assert.deepStrictEqual(calls.map(call => call.variables), [{ first: 3, after: null }, { first: 1, after: 'c1' }]);
        });

        it('should emit the checkout id alone when the checkout is not listed yet', async () => {
            const { run } = mockRun(() => ({ node: null }));
            const fetch = gqlStore.checkoutFetcher(gqlStore(run));
            assert.deepStrictEqual(await fetch(undefined, { id: 123, token: 'tok' }), { id: 'gid://shopify/AbandonedCheckout/123', token: 'tok' });
            assert.deepStrictEqual(await fetch(null, { token: 'tok' }), { id: null, token: 'tok' });
        });

        it('should read an inventory level by gid or by item and location', async () => {
            const { run, calls } = mockRun(query => (/inventoryItem\(/.test(query)
                ? { inventoryItem: { inventoryLevel: LEVEL } }
                : { inventoryLevel: LEVEL }));
            const api = gqlStore(run);

            const byId = await api.getInventoryLevel({ id: LEVEL_ID });
            assert.deepStrictEqual(calls[0].variables, { id: LEVEL_ID });
            assert.deepStrictEqual(byId.item.variants, LEVEL.item.variants.nodes);

            await api.getInventoryLevel({ inventoryItemId: 64806874841169, locationId: '124679880785' });
            assert.deepStrictEqual(calls[1].variables, {
                itemId: 'gid://shopify/InventoryItem/64806874841169',
                locationId: 'gid://shopify/Location/124679880785'
            });
        });

        it('should read the newest return of the recent orders', async () => {
            const { run, calls } = mockRun(query => (/RecentReturns/.test(query)
                ? {
                    orders: {
                        nodes: [
                            { returns: { nodes: [] } },
                            { returns: { nodes: [{ id: 'gid://shopify/Return/1', createdAt: '2026-10-01T00:00:00Z' }] } },
                            { returns: { nodes: [{ id: RETURN.id, createdAt: '2026-10-03T09:00:00Z' }] } }
                        ]
                    }
                }
                : { return: RETURN }));
            const ret = await gqlStore(run).latestReturn();
            assert.deepStrictEqual(calls[1].variables, { id: RETURN.id });
            assert.deepStrictEqual(ret.returnLineItems, RETURN.returnLineItems.nodes);
            assert.deepStrictEqual(ret.reverseFulfillmentOrders, RETURN.reverseFulfillmentOrders.nodes);
        });
    });

    describe('triggers', () => {

        it('AbandonedCart should record the checkouts on the first tick and emit only new ones later', async () => {
            const component = require('../../checkouts/AbandonedCart/AbandonedCart');
            let nodes = [CHECKOUT];
            const pageInfo = { hasNextPage: false, endCursor: null };
            const handler = () => ({ abandonedCheckouts: { nodes, pageInfo } });

            const context = mockContext(handler);
            await component.tick(context);
            assert.deepStrictEqual(context.sent, []);
            assert.deepStrictEqual(context.state, { known: [CHECKOUT.id] });

            const second = { ...CHECKOUT, id: 'gid://shopify/AbandonedCheckout/2' };
            nodes = [second, CHECKOUT];
            const next = mockContext(handler, { state: context.state });
            await component.tick(next);
            assert.deepStrictEqual(next.sent.map(message => [message.port, message.payload.id]), [['out', second.id]]);
            assert.deepStrictEqual(next.state, { known: [second.id, CHECKOUT.id] });
        });

        it('NewDraftOrder should emit the draft order read through GraphQL with the topic', async () => {
            const context = mockContext(() => ({ draftOrder: DRAFT_ORDER }), {
                webhook: {
                    headers: { 'x-shopify-topic': 'draft_orders/create', 'x-shopify-event-id': 'e1' },
                    data: { id: 1698576236625, admin_graphql_api_id: DRAFT_ORDER.id }
                }
            });
            await require('../../draftorders/NewDraftOrder/NewDraftOrder').receive(context);
            assert.deepStrictEqual(context.calls[0].variables, { id: DRAFT_ORDER.id });
            assert.strictEqual(context.sent[0].port, 'out');
            assert.strictEqual(context.sent[0].payload.webhookTopic, 'draft_orders/create');
            assert.deepStrictEqual(context.sent[0].payload.lineItems, DRAFT_ORDER.lineItems.nodes);
        });

        it('InventoryLevelUpdated should read the level by admin_graphql_api_id', async () => {
            const context = mockContext(() => ({ inventoryLevel: LEVEL }), {
                webhook: {
                    headers: { 'x-shopify-topic': 'inventory_levels/update' },
                    data: { admin_graphql_api_id: LEVEL_ID }
                }
            });
            await require('../../inventory/InventoryLevelUpdated/InventoryLevelUpdated').receive(context);
            assert.deepStrictEqual(context.calls[0].variables, { id: LEVEL_ID });
            assert.strictEqual(context.sent[0].payload.id, LEVEL_ID);
            assert.strictEqual(context.sent[0].payload.webhookTopic, 'inventory_levels/update');
        });

        it('NewCheckout should emit the checkout id when Shopify does not list the checkout yet', async () => {
            const context = mockContext(() => ({ node: null }), {
                webhook: { headers: { 'x-shopify-topic': 'checkouts/create' }, data: { id: 123 } }
            });
            await require('../../checkouts/NewCheckout/NewCheckout').receive(context);
            assert.deepStrictEqual(context.sent, [{
                port: 'out',
                payload: { id: 'gid://shopify/AbandonedCheckout/123', token: null, webhookTopic: 'checkouts/create' }
            }]);
        });

        it('ReturnTracking test() should emit the newest return with the first selected topic', async () => {
            const context = mockContext(query => (/RecentReturns/.test(query)
                ? { orders: { nodes: [{ returns: { nodes: [{ id: RETURN.id, createdAt: RETURN.createdAt }] } }] } }
                : { return: RETURN }), { properties: { topics: ['returns/approve', 'returns/close'] } });
            await require('../../returns/ReturnTracking/ReturnTracking').test(context);
            assert.strictEqual(context.sent[0].payload.id, RETURN.id);
            assert.strictEqual(context.sent[0].payload.webhookTopic, 'returns/approve');
        });

        it('UpdatedDraftOrder test() should cancel on a store without draft orders', async () => {
            const context = mockContext(() => ({ draftOrders: { nodes: [] } }));
            await assert.rejects(require('../../draftorders/UpdatedDraftOrder/UpdatedDraftOrder').test(context), CancelError);
            assert.deepStrictEqual(context.calls[0].variables, { sortKey: 'UPDATED_AT' });
        });
    });

    describe('output schemas', () => {

        // component → [item schema key, extra properties of the port]
        const PORTS = {
            'checkouts/AbandonedCart': ['checkout', []],
            'checkouts/NewCheckout': ['checkout', ['webhookTopic', 'token']],
            'checkouts/UpdatedCheckout': ['checkout', ['webhookTopic', 'token']],
            'draftorders/NewDraftOrder': ['draftOrder', ['webhookTopic']],
            'draftorders/UpdatedDraftOrder': ['draftOrder', ['webhookTopic']],
            'inventory/InventoryLevelUpdated': ['inventoryLevel', ['webhookTopic']],
            'returns/ReturnTracking': ['return', ['webhookTopic']]
        };

        for (const [key, schema] of Object.entries(ITEM_SCHEMAS)) {
            it(`should require only declared properties of ${key}`, () => {
                for (const field of schema.required) {
                    assert.ok(schema.properties[field], field);
                }
            });
        }

        for (const [path, [key, extra]] of Object.entries(PORTS)) {
            it(`should give ${path} the ${key} item schema`, () => {
                const port = require(`../../${path}/component.json`).outPorts.find(p => p.name === 'out');
                const properties = { ...port.schema.properties };
                for (const field of extra) {
                    assert.ok(properties[field], `${path} lacks ${field}`);
                    delete properties[field];
                }
                assert.deepStrictEqual(properties, ITEM_SCHEMAS[key].properties);
                for (const field of port.schema.required) {
                    assert.ok(port.schema.properties[field], field);
                }
            });
        }
    });
});

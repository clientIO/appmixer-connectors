const assert = require('assert');
const ITEM_SCHEMA_FILE = require('../../item-schema-products.json');
const FindProducts = require('../../products/FindProducts/FindProducts');
const UpdatedProduct = require('../../products/UpdatedProduct/UpdatedProduct');
const NewProduct = require('../../products/NewProduct/NewProduct');

const PRODUCT_SCHEMA = ITEM_SCHEMA_FILE.product;

// Static product ports must equal the schema file; triggers add webhookTopic.
const STATIC_PORTS = {
    GetProduct: [],
    CreateProduct: [],
    NewProduct: ['webhookTopic'],
    UpdatedProduct: ['webhookTopic']
};

function leaves(schema, path = '') {

    const out = [];
    for (const [key, value] of Object.entries(schema.properties || {})) {
        const at = path ? `${path}.${key}` : key;
        if (value.type === 'object' && value.properties) out.push(...leaves(value, at));
        else if (value.type === 'array' && value.items && value.items.properties) out.push([at, value], ...leaves(value.items, at + '[]'));
        else out.push([at, value]);
    }
    return out;
}

function product(overrides = {}) {

    return {
        id: 'gid://shopify/Product/1',
        title: 'Shirt',
        hasOnlyDefaultVariant: false,
        createdAt: '2026-10-05T08:00:00Z',
        updatedAt: '2026-10-05T08:00:01Z',
        variants: [
            { id: 'gid://shopify/ProductVariant/11', title: 'S' },
            { id: 'gid://shopify/ProductVariant/12', title: 'M' }
        ],
        media: [],
        ...overrides
    };
}

describe('Shopify products', () => {

    describe('output schema', () => {

        it('should export the schema file as FindProducts ITEM_SCHEMA', () => {
            assert.strictEqual(FindProducts.ITEM_SCHEMA, PRODUCT_SCHEMA);
            assert.strictEqual(PRODUCT_SCHEMA.type, 'object');
            assert.ok(PRODUCT_SCHEMA.required.includes('id'));
            for (const key of PRODUCT_SCHEMA.required) {
                assert.ok(PRODUCT_SCHEMA.properties[key], `required ${key} is not a property`);
            }
        });

        it('should give every leaf a title and an example', () => {
            for (const [path, leaf] of leaves(PRODUCT_SCHEMA)) {
                assert.ok(leaf.title, `${path} has no title`);
                assert.ok(leaf.example !== undefined, `${path} has no example`);
            }
        });

        for (const [name, extra] of Object.entries(STATIC_PORTS)) {

            it(`should give ${name} the product schema`, () => {
                const component = require(`../../products/${name}/component.json`);
                const port = component.outPorts.find(p => p.name === 'out');
                assert.strictEqual(port.source, undefined);
                const properties = { ...port.schema.properties };
                const required = port.schema.required.filter(key => !extra.includes(key));
                for (const key of extra) {
                    assert.ok(properties[key], `${name} lacks ${key}`);
                    delete properties[key];
                }
                assert.deepStrictEqual(properties, PRODUCT_SCHEMA.properties);
                assert.deepStrictEqual(required, PRODUCT_SCHEMA.required);
            });
        }
    });

    describe('FindProducts transforms', () => {

        it('should list products as id options', () => {
            assert.deepStrictEqual(FindProducts.productsToSelectArray({ result: [product()], count: 1 }),
                [{ label: 'Shirt', value: 'gid://shopify/Product/1' }]);
            assert.deepStrictEqual(FindProducts.productsToSelectArray(undefined), []);
        });

        it('should list variants as "Product — Variant" with the variant gid', () => {
            const out = {
                result: [
                    product(),
                    product({
                        id: 'gid://shopify/Product/2', title: 'Mug', hasOnlyDefaultVariant: true,
                        variants: [{ id: 'gid://shopify/ProductVariant/21', title: 'Default Title' }]
                    })
                ]
            };
            assert.deepStrictEqual(FindProducts.variantsToSelectArray(out), [
                { value: 'gid://shopify/ProductVariant/11', label: 'Shirt — S' },
                { value: 'gid://shopify/ProductVariant/12', label: 'Shirt — M' },
                { value: 'gid://shopify/ProductVariant/21', label: 'Mug' }
            ]);
        });
    });

    describe('triggers', () => {

        // A component context whose Shopify GraphQL calls answer `product`.
        function webhookContext(answer) {

            const sent = [];
            const requests = [];
            const context = {
                auth: { store: 'acme', accessToken: 't' },
                config: {},
                componentId: 'c1',
                messages: {
                    webhook: {
                        content: {
                            headers: { 'x-shopify-topic': 'products/update', 'x-shopify-event-id': 'e1' },
                            data: { id: 1, admin_graphql_api_id: 'gid://shopify/Product/1' }
                        }
                    }
                },
                staticCache: { get: async () => null, set: async () => {} },
                httpRequest: async options => {
                    requests.push(options);
                    return { data: { data: { product: answer } }, headers: {} };
                },
                sendJson: async (data, port) => sent.push({ data, port }),
                response: () => 'ok'
            };
            return { context, sent, requests };
        }

        it('should skip the update that is part of creating the product', async () => {
            const { context, sent, requests } = webhookContext(product());
            await UpdatedProduct.receive(context);
            assert.strictEqual(requests[0].data.variables.id, 'gid://shopify/Product/1');
            assert.deepStrictEqual(sent, []);
        });

        it('should emit a later update with the webhook topic', async () => {
            const { context, sent } = webhookContext(product({ updatedAt: '2026-10-05T09:00:00Z' }));
            await UpdatedProduct.receive(context);
            assert.strictEqual(sent.length, 1);
            assert.strictEqual(sent[0].port, 'out');
            assert.strictEqual(sent[0].data.webhookTopic, 'products/update');
            assert.strictEqual(sent[0].data.title, 'Shirt');
        });

        it('should emit nothing for a product that is gone already', async () => {
            const { context, sent } = webhookContext(null);
            await NewProduct.receive(context);
            assert.deepStrictEqual(sent, []);
        });
    });
});

const assert = require('assert');
const gqlProducts = require('../../gql-products');
const { flatten, buildSearchQuery, toProductInput, decodeAttachment, imageList, queries } = gqlProducts;

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAADklEQVR4nGNoQAIMxHEAcFIYAYPG8BkAAAAASUVORK5CYII=';
const PRODUCT_GID = 'gid://shopify/Product/16347478065233';

// Product as returned live by the 2026-10 Admin API (QA store), trimmed.
function liveProduct(overrides = {}) {

    return {
        id: PRODUCT_GID,
        legacyResourceId: '16347478065233',
        title: 'gql4-probe A',
        handle: 'gql4-probe-a',
        descriptionHtml: '<b>hi</b>',
        vendor: 'gql4-probe',
        productType: 'Probe4',
        status: 'DRAFT',
        tags: ['x', 'y z'],
        createdAt: '2026-10-05T08:22:31Z',
        updatedAt: '2026-10-05T08:22:33Z',
        publishedAt: null,
        templateSuffix: null,
        onlineStoreUrl: null,
        totalInventory: 0,
        tracksInventory: false,
        hasOnlyDefaultVariant: true,
        seo: { title: null, description: null },
        category: null,
        priceRangeV2: {
            minVariantPrice: { amount: '0.0', currencyCode: 'USD' },
            maxVariantPrice: { amount: '0.0', currencyCode: 'USD' }
        },
        options: [{ id: 'gid://shopify/ProductOption/18960245588049', name: 'Title', position: 1, values: ['Default Title'] }],
        variants: {
            nodes: [{
                id: 'gid://shopify/ProductVariant/62809874268241',
                legacyResourceId: '62809874268241',
                title: 'Default Title',
                displayName: 'gql4-probe A - Default Title',
                sku: null,
                price: '0.00',
                compareAtPrice: null,
                position: 1,
                inventoryPolicy: 'DENY',
                inventoryQuantity: 0,
                taxable: true,
                availableForSale: true,
                createdAt: '2026-10-05T08:22:31Z',
                updatedAt: '2026-10-05T08:22:31Z',
                barcodes: { nodes: [] },
                selectedOptions: [{ name: 'Title', value: 'Default Title' }],
                inventoryItem: {
                    id: 'gid://shopify/InventoryItem/64827969437777',
                    tracked: false,
                    requiresShipping: true,
                    measurement: { weight: { unit: 'POUNDS', value: 0 } }
                }
            }]
        },
        media: {
            nodes: [{
                id: 'gid://shopify/MediaImage/73881115492433',
                alt: 'ph',
                mediaContentType: 'IMAGE',
                status: 'READY',
                preview: { image: { url: 'https://cdn.shopify.com/s/files/1/1079/6174/5489/files/placeholder.png?v=1791188552', width: 480, height: 480 } }
            }]
        },
        ...overrides
    };
}

// Fake `run`: records the calls and answers by operation name.
function fakeRun(handlers) {

    const calls = [];
    const run = async (query, variables) => {
        const name = query.match(/(?:query|mutation) (\w+)/)[1];
        calls.push({ name, query, variables });
        const handler = handlers[name];
        if (!handler) throw new Error(`unexpected ${name}`);
        return typeof handler === 'function' ? handler(variables, calls) : handler;
    };
    return { run, calls };
}

const UPDATED = { productUpdate: { product: { id: PRODUCT_GID }, userErrors: [] } };
const DELETED = { productDelete: { deletedProductId: PRODUCT_GID, userErrors: [] } };

const PUBLICATIONS_PAGE = {
    publications: {
        nodes: [
            { id: 'gid://shopify/Publication/1', catalog: { title: 'Point of Sale', apps: { nodes: [{ handle: 'pos' }] } } },
            { id: 'gid://shopify/Publication/2', catalog: { title: 'Online Store', apps: { nodes: [{ handle: 'online_store' }] } } }
        ],
        pageInfo: { hasNextPage: false, endCursor: null }
    }
};

describe('gql-products', () => {

    describe('flatten', () => {

        it('should turn the connections into arrays and keep everything else', () => {
            const product = flatten(liveProduct());
            assert.strictEqual(product.id, PRODUCT_GID);
            assert.strictEqual(product.legacyResourceId, '16347478065233');
            assert.deepStrictEqual(product.tags, ['x', 'y z']);
            assert.strictEqual(product.status, 'DRAFT');
            assert.ok(Array.isArray(product.variants));
            assert.deepStrictEqual(product.variants[0].barcodes, []);
            assert.strictEqual(product.variants[0].price, '0.00');
            assert.strictEqual(product.media[0].preview.image.width, 480);
        });

        it('should give empty arrays for missing connections', () => {
            const product = flatten({ id: PRODUCT_GID });
            assert.deepStrictEqual(product.variants, []);
            assert.deepStrictEqual(product.media, []);
        });
    });

    describe('buildSearchQuery', () => {

        it('should return undefined without filters', () => {
            assert.strictEqual(buildSearchQuery({}), undefined);
            assert.strictEqual(buildSearchQuery({ vendor: '', status: '  ' }), undefined);
        });

        it('should AND the query with quoted filters', () => {
            assert.strictEqual(buildSearchQuery({
                query: 'title:shirt*',
                vendor: 'Acme "Best"',
                productType: 'T-Shirts',
                status: 'ACTIVE',
                collectionId: 'gid://shopify/Collection/703179849809',
                tag: 'summer'
            }), '(title:shirt*) AND vendor:"Acme \\"Best\\"" AND product_type:"T-Shirts" AND status:"active"'
                + ' AND collection_id:"703179849809" AND tag:"summer"');
        });

        it('should OR several statuses', () => {
            assert.strictEqual(buildSearchQuery({ status: 'ACTIVE, draft' }), '(status:"active" OR status:"draft")');
        });

        it('should turn date ranges into ISO timestamps', () => {
            assert.strictEqual(buildSearchQuery({
                createdAtMin: '2026-10-05T00:00:00Z',
                createdAtMax: '2026-10-06',
                updatedAtMin: '2026-10-05T10:00:00+02:00',
                updatedAtMax: '2030-01-01T00:00:00.000Z'
            }), 'created_at:>="2026-10-05T00:00:00.000Z" AND created_at:<="2026-10-06T00:00:00.000Z"'
                + ' AND updated_at:>="2026-10-05T08:00:00.000Z" AND updated_at:<="2030-01-01T00:00:00.000Z"');
        });

        it('should reject an invalid date', () => {
            assert.throws(() => buildSearchQuery({ createdAtMin: 'yesterday-ish' }), /Created After is not a valid date/);
        });
    });

    describe('toProductInput', () => {

        it('should map the inputs and leave empty ones out', () => {
            assert.deepStrictEqual(toProductInput({
                title: 'T', descriptionHtml: '<p>d</p>', vendor: '', productType: 'P', tags: 'a, b ,', status: 'draft',
                publishToOnlineStore: true, images: { ADD: [] }
            }), { title: 'T', descriptionHtml: '<p>d</p>', productType: 'P', tags: ['a', 'b'], status: 'DRAFT' });
            assert.deepStrictEqual(toProductInput({}), {});
        });
    });

    describe('imageList', () => {

        it('should accept the expression shape and arrays', () => {
            assert.deepStrictEqual(imageList({ ADD: [{ url: 'u' }] }), [{ url: 'u' }]);
            assert.deepStrictEqual(imageList([{ url: 'u' }]), [{ url: 'u' }]);
            assert.deepStrictEqual(imageList(undefined), []);
            assert.deepStrictEqual(imageList('x'), []);
        });
    });

    describe('decodeAttachment', () => {

        it('should detect PNG from base64 and from a data URL', () => {
            assert.strictEqual(decodeAttachment(PNG_BASE64).mimeType, 'image/png');
            const decoded = decodeAttachment('data:image/png;base64,' + PNG_BASE64);
            assert.strictEqual(decoded.extension, 'png');
            assert.ok(decoded.buffer.length > 0);
        });

        it('should reject empty data', () => {
            assert.throws(() => decodeAttachment(''), /empty or not valid base64/);
        });
    });

    describe('get', () => {

        it('should query by gid built from a numeric id and flatten', async () => {
            const { run, calls } = fakeRun({ GetProduct: { product: liveProduct() } });
            const product = await gqlProducts(run).get('16347478065233');
            assert.strictEqual(calls[0].variables.id, PRODUCT_GID);
            assert.ok(Array.isArray(product.variants));
        });

        it('should throw 404 when the product does not exist', async () => {
            const { run } = fakeRun({ GetProduct: { product: null } });
            await assert.rejects(gqlProducts(run).get(PRODUCT_GID), err => err.statusCode === 404);
        });

        it('should return null from getOrNull when the product does not exist', async () => {
            const { run } = fakeRun({ GetProduct: { product: null } });
            assert.strictEqual(await gqlProducts(run).getOrNull(PRODUCT_GID), null);
        });
    });

    describe('find', () => {

        it('should page by 50 up to 250 products with query, sort and reverse', async () => {
            let page = 0;
            const { run, calls } = fakeRun({
                FindProducts: () => {
                    page++;
                    return {
                        products: {
                            nodes: Array.from({ length: 50 }, () => liveProduct()),
                            pageInfo: { hasNextPage: true, endCursor: 'c' + page }
                        }
                    };
                }
            });
            const products = await gqlProducts(run).find({ vendor: 'Acme', sortKey: 'CREATED_AT', reverse: true });
            assert.strictEqual(products.length, 250);
            assert.strictEqual(calls.length, 5);
            assert.deepStrictEqual(calls[0].variables, {
                first: 50, after: null, query: 'vendor:"Acme"', sortKey: 'CREATED_AT', reverse: true
            });
            assert.strictEqual(calls[1].variables.after, 'c1');
        });

        it('should stop at the last page and send nulls for no filters', async () => {
            const { run, calls } = fakeRun({
                FindProducts: {
                    products: { nodes: [liveProduct()], pageInfo: { hasNextPage: false, endCursor: null } }
                }
            });
            const products = await gqlProducts(run).find();
            assert.strictEqual(products.length, 1);
            assert.deepStrictEqual(calls[0].variables,
                { first: 50, after: null, query: null, sortKey: null, reverse: false });
        });

        it('should keep the Find selection within the query cost limit (100 variants, 50 media)', () => {
            assert.ok(queries.FIND_PRODUCTS.includes('variants: variants(first: 100)'));
            assert.ok(queries.FIND_PRODUCTS.includes('media: media(first: 50)'));
        });
    });

    describe('recent', () => {

        it('should ask for the newest products by the sort key', async () => {
            const { run, calls } = fakeRun({
                FindProducts: { products: { nodes: [liveProduct()], pageInfo: { hasNextPage: false } } }
            });
            const products = await gqlProducts(run).recent('UPDATED_AT', 10);
            assert.deepStrictEqual(calls[0].variables, { first: 10, sortKey: 'UPDATED_AT', reverse: true });
            assert.ok(Array.isArray(products[0].media));
        });
    });

    describe('count', () => {

        it('should count with the same filters as find', async () => {
            const { run, calls } = fakeRun({ CountProducts: { productsCount: { count: 7 } } });
            assert.strictEqual(await gqlProducts(run).count({ tag: 'summer', outputType: 'array' }), 7);
            assert.deepStrictEqual(calls[0].variables, { query: 'tag:"summer"' });
        });

        it('should send a null query without filters', async () => {
            const { run, calls } = fakeRun({ CountProducts: { productsCount: { count: 24 } } });
            assert.strictEqual(await gqlProducts(run).count({}), 24);
            assert.deepStrictEqual(calls[0].variables, { query: null });
        });
    });

    describe('create', () => {

        it('should create with URL and base64 images, wait for media, and return the product', async () => {
            const puts = [];
            let gets = 0;
            const { run, calls } = fakeRun({
                StagedUpload: {
                    stagedUploadsCreate: {
                        stagedTargets: [{ url: 'https://upload.example/put', resourceUrl: 'https://upload.example/res', parameters: [] }],
                        userErrors: []
                    }
                },
                CreateProduct: { productCreate: { product: { id: PRODUCT_GID }, userErrors: [] } },
                GetProduct: () => {
                    gets++;
                    const status = gets === 1 ? 'PROCESSING' : 'READY';
                    return { product: liveProduct({ media: { nodes: [{ id: 'm', mediaContentType: 'IMAGE', status }] } }) };
                }
            });
            const api = gqlProducts(run, {
                putFile: async (url, data, headers) => puts.push({ url, size: data.length, headers }),
                sleep: async () => {}
            });

            const product = await api.create({
                title: 'T',
                status: 'DRAFT',
                images: { ADD: [{ url: 'https://img.example/a.png', alt: 'A' }, { attachment: PNG_BASE64 }, {}] }
            });

            const create = calls.find(call => call.name === 'CreateProduct');
            assert.deepStrictEqual(create.variables, {
                product: { title: 'T', status: 'DRAFT' },
                media: [
                    { originalSource: 'https://img.example/a.png', mediaContentType: 'IMAGE', alt: 'A' },
                    { originalSource: 'https://upload.example/res', mediaContentType: 'IMAGE' }
                ]
            });
            const staged = calls.find(call => call.name === 'StagedUpload');
            assert.strictEqual(staged.variables.input[0].mimeType, 'image/png');
            assert.strictEqual(staged.variables.input[0].httpMethod, 'PUT');
            assert.deepStrictEqual(puts[0].headers, { 'Content-Type': 'image/png' });
            assert.strictEqual(gets, 2);
            assert.strictEqual(product.media[0].status, 'READY');
            assert.ok(!calls.some(call => call.name === 'Publications'));
        });

        it('should fail a base64 image without an upload function', async () => {
            const { run } = fakeRun({});
            await assert.rejects(gqlProducts(run).create({ title: 'T', images: [{ attachment: PNG_BASE64 }] }), /need a file upload/);
        });

        it('should publish to the Online Store publication', async () => {
            const { run, calls } = fakeRun({
                CreateProduct: { productCreate: { product: { id: PRODUCT_GID }, userErrors: [] } },
                Publications: PUBLICATIONS_PAGE,
                Publish: { publishablePublish: { userErrors: [] } },
                GetProduct: { product: liveProduct({ publishedAt: '2026-10-05T08:30:00Z' }) }
            });
            const product = await gqlProducts(run).create({ title: 'T', publishToOnlineStore: true });
            const publish = calls.find(call => call.name === 'Publish');
            assert.deepStrictEqual(publish.variables, { id: PRODUCT_GID, input: [{ publicationId: 'gid://shopify/Publication/2' }] });
            assert.ok(publish.query.includes('publishablePublish'));
            assert.strictEqual(product.publishedAt, '2026-10-05T08:30:00Z');
        });

        it('should find the Online Store by catalog title on a later page', async () => {
            const { run, calls } = fakeRun({
                Publications: variables => variables.after
                    ? { publications: { nodes: [{ id: 'gid://shopify/Publication/9', catalog: { title: 'Online Store' } }], pageInfo: { hasNextPage: false } } }
                    : { publications: { nodes: [{ id: 'gid://shopify/Publication/1', catalog: null }], pageInfo: { hasNextPage: true, endCursor: 'p1' } } }
            });
            assert.strictEqual(await gqlProducts(run).onlineStorePublicationId(), 'gid://shopify/Publication/9');
            assert.strictEqual(calls.length, 2);
        });

        it('should fail when the store has no Online Store', async () => {
            const { run } = fakeRun({
                Publications: { publications: { nodes: [], pageInfo: { hasNextPage: false } } }
            });
            await assert.rejects(gqlProducts(run).onlineStorePublicationId(), /no Online Store/);
        });

        it('should delete the new product when publishing fails (no publications access)', async () => {
            const denied = Object.assign(new Error('Access denied for publications field.'), { statusCode: 403 });
            const { run, calls } = fakeRun({
                CreateProduct: { productCreate: { product: { id: PRODUCT_GID }, userErrors: [] } },
                Publications: () => { throw denied; },
                DeleteProduct: { productDelete: { deletedProductId: PRODUCT_GID, userErrors: [] } }
            });
            await assert.rejects(gqlProducts(run).create({ title: 'T', publishToOnlineStore: true }),
                err => err.statusCode === 403 && /the product was not created: Access denied/.test(err.message));
            const deleted = calls.find(call => call.name === 'DeleteProduct');
            assert.deepStrictEqual(deleted.variables, { input: { id: PRODUCT_GID } });
        });

        it('should throw 422 on userErrors', async () => {
            const { run } = fakeRun({
                CreateProduct: { productCreate: { product: null, userErrors: [{ field: ['title'], message: "Title can't be blank" }] } }
            });
            await assert.rejects(gqlProducts(run).create({ title: ' ' }), err => err.statusCode === 422);
        });
    });

    describe('update', () => {

        it('should update the given fields and add images', async () => {
            const { run, calls } = fakeRun({ UpdateProduct: UPDATED });
            const result = await gqlProducts(run).update('16347478065233', {
                title: 'New', tags: 'q', images: { ADD: [{ url: 'https://img.example/b.png' }] }
            });
            assert.strictEqual(result, undefined);
            assert.deepStrictEqual(calls[0].variables, {
                product: { title: 'New', tags: ['q'], id: PRODUCT_GID },
                media: [{ originalSource: 'https://img.example/b.png', mediaContentType: 'IMAGE' }]
            });
        });

        it('should only publish when nothing else changes', async () => {
            const { run, calls } = fakeRun({
                Publications: PUBLICATIONS_PAGE,
                Publish: { publishablePublish: { userErrors: [] } }
            });
            await gqlProducts(run).update(PRODUCT_GID, { publishToOnlineStore: true });
            assert.deepStrictEqual(calls.map(call => call.name), ['Publications', 'Publish']);
        });

        it('should not unpublish when the toggle is off', async () => {
            const { run, calls } = fakeRun({ UpdateProduct: UPDATED });
            await gqlProducts(run).update(PRODUCT_GID, { title: 'x', publishToOnlineStore: false });
            assert.deepStrictEqual(calls.map(call => call.name), ['UpdateProduct']);
        });

        it('should answer a missing product with 404', async () => {
            const { run } = fakeRun({
                UpdateProduct: { productUpdate: { product: null, userErrors: [{ field: ['id'], message: 'Product does not exist' }] } }
            });
            await assert.rejects(gqlProducts(run).update(PRODUCT_GID, { title: 'x' }), err => err.statusCode === 404);
        });
    });

    describe('delete', () => {

        it('should delete by gid', async () => {
            const { run, calls } = fakeRun({ DeleteProduct: DELETED });
            await gqlProducts(run).delete('16347478065233');
            assert.deepStrictEqual(calls[0].variables, { input: { id: PRODUCT_GID } });
        });

        it('should answer a missing product with 404', async () => {
            const { run } = fakeRun({
                DeleteProduct: { productDelete: { deletedProductId: null, userErrors: [{ field: ['id'], message: 'Product does not exist' }] } }
            });
            await assert.rejects(gqlProducts(run).delete(PRODUCT_GID), err => err.statusCode === 404);
        });
    });
});

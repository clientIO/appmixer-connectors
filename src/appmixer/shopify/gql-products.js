'use strict';

// Products on the GraphQL Admin API. Objects are returned as GraphQL returns
// them (camelCase fields, global ids, enums, Money scalars); the only reshaping
// is that connections become plain arrays (`variants: [...]`, `media: [...]`
// instead of `{ nodes: [...] }`).

const client = require('./graphql-client');

const { ShopifyError, toGid, fromGid } = client;

// Find pages: a product with 100 variants and 50 media costs ~14 points, so 50
// products stay under the 1000-point single query limit.
const FIND_PAGE_SIZE = 50;
const FIND_MAX = 250;

// Media added by URL or upload is processed asynchronously. Create waits a few
// seconds so the emitted product carries the image URLs.
const MEDIA_WAIT_ATTEMPTS = 8;
const MEDIA_WAIT_MS = 1000;
const MEDIA_PENDING = ['UPLOADED', 'PROCESSING'];

const ONLINE_STORE_HANDLE = 'online_store';
const ONLINE_STORE_TITLE = 'Online Store';

const MEDIA_FIELDS = 'id alt mediaContentType status preview { image { url width height } }';

const VARIANT_FIELDS = `
    id legacyResourceId title displayName sku price compareAtPrice position inventoryPolicy inventoryQuantity
    taxable availableForSale createdAt updatedAt
    barcodes: barcodes(first: 5) { nodes { type value } }
    selectedOptions { name value }
    inventoryItem { id tracked requiresShipping measurement { weight { unit value } } }`;

const productFields = (variants, media) => `
    id legacyResourceId title handle descriptionHtml vendor productType status tags
    createdAt updatedAt publishedAt templateSuffix onlineStoreUrl totalInventory tracksInventory hasOnlyDefaultVariant
    seo { title description }
    category { id name fullName }
    priceRangeV2 { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
    options { id name position values }
    variants: variants(first: ${variants}) { nodes { ${VARIANT_FIELDS} } }
    media: media(first: ${media}) { nodes { ${MEDIA_FIELDS} } }`;

const PRODUCT_FIELDS = productFields(250, 250);
const FIND_PRODUCT_FIELDS = productFields(100, 50);

const GET_PRODUCT = `query GetProduct($id: ID!) {
    product(id: $id) { ${PRODUCT_FIELDS} }
}`;

const FIND_PRODUCTS = `query FindProducts($first: Int!, $after: String, $query: String, $sortKey: ProductSortKeys, $reverse: Boolean) {
    products(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
        nodes { ${FIND_PRODUCT_FIELDS} }
        pageInfo { hasNextPage endCursor }
    }
}`;

const COUNT_PRODUCTS = `query CountProducts($query: String) {
    productsCount(query: $query, limit: null) { count }
}`;

const CREATE_PRODUCT = `mutation CreateProduct($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
    productCreate(product: $product, media: $media) {
        product { id }
        userErrors { field message }
    }
}`;

const UPDATE_PRODUCT = `mutation UpdateProduct($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
    productUpdate(product: $product, media: $media) {
        product { id }
        userErrors { field message }
    }
}`;

const DELETE_PRODUCT = `mutation DeleteProduct($input: ProductDeleteInput!) {
    productDelete(input: $input) {
        deletedProductId
        userErrors { field message }
    }
}`;

const STAGED_UPLOAD = `mutation StagedUpload($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
    }
}`;

// The Online Store is the publication whose app catalog belongs to the
// online_store app (read_publications).
const PUBLICATIONS = `query Publications($after: String) {
    publications(first: 50, after: $after) {
        nodes {
            id
            catalog { title ... on AppCatalog { apps(first: 5) { nodes { handle } } } }
        }
        pageInfo { hasNextPage endCursor }
    }
}`;

const PUBLISH = `mutation Publish($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
        userErrors { field message }
    }
}`;

const nodes = connection => (connection && connection.nodes) || [];
const isSet = value => value !== undefined && value !== null && String(value).trim() !== '';

/**
 * connection { nodes } → array, for the connections in the selection.
 * @param {object} product
 * @returns {object}
 */
function flatten(product) {

    if (!product) return product;
    return {
        ...product,
        variants: nodes(product.variants).map(variant => ({ ...variant, barcodes: nodes(variant.barcodes) })),
        media: nodes(product.media)
    };
}

// Shopify search syntax value: always quoted, so spaces, colons (dates) and
// quotes in user input cannot change the query.
function quote(value) {

    return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function toDate(value, label) {

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new ShopifyError(`${label} is not a valid date: "${value}".`, 422);
    }
    return date.toISOString();
}

/**
 * Typed filters → products search query (undefined when there is none). The
 * free-form `query` is kept as written and ANDed with the filters.
 * @param {object} filters
 * @param {string} [filters.query] Shopify product search syntax
 * @param {string} [filters.vendor]
 * @param {string} [filters.productType]
 * @param {string} [filters.status] ProductStatus, or several separated by commas
 * @param {string} [filters.collectionId] gid or numeric id
 * @param {string} [filters.tag]
 * @param {string} [filters.createdAtMin]
 * @param {string} [filters.createdAtMax]
 * @param {string} [filters.updatedAtMin]
 * @param {string} [filters.updatedAtMax]
 * @returns {string|undefined}
 */
function buildSearchQuery(filters = {}) {

    const terms = [];
    if (isSet(filters.query)) terms.push(`(${String(filters.query).trim()})`);
    if (isSet(filters.vendor)) terms.push(`vendor:${quote(filters.vendor)}`);
    if (isSet(filters.productType)) terms.push(`product_type:${quote(filters.productType)}`);
    if (isSet(filters.status)) {
        const statuses = String(filters.status).split(',').map(status => status.trim()).filter(Boolean)
            .map(status => `status:${quote(status.toLowerCase())}`);
        if (statuses.length) terms.push(statuses.length > 1 ? `(${statuses.join(' OR ')})` : statuses[0]);
    }
    if (isSet(filters.collectionId)) terms.push(`collection_id:${quote(fromGid(String(filters.collectionId).trim()))}`);
    if (isSet(filters.tag)) terms.push(`tag:${quote(filters.tag)}`);
    const ranges = [
        ['createdAtMin', 'created_at', '>=', 'Created After'],
        ['createdAtMax', 'created_at', '<=', 'Created Before'],
        ['updatedAtMin', 'updated_at', '>=', 'Updated After'],
        ['updatedAtMax', 'updated_at', '<=', 'Updated Before']
    ];
    for (const [key, field, operator, label] of ranges) {
        if (isSet(filters[key])) terms.push(`${field}:${operator}${quote(toDate(filters[key], label))}`);
    }
    return terms.length ? terms.join(' AND ') : undefined;
}

/**
 * The Images expression ({ ADD: [...] }) or a plain array → array of images.
 * @param {object|object[]} images
 * @returns {object[]}
 */
function imageList(images) {

    if (Array.isArray(images)) return images;
    if (images && Array.isArray(images.ADD)) return images.ADD;
    return [];
}

/**
 * Component inputs → ProductCreateInput / ProductUpdateInput. Empty inputs stay
 * out of the input, so an update leaves those fields unchanged.
 * @param {object} fields
 * @returns {object}
 */
function toProductInput(fields = {}) {

    const input = {};
    for (const key of ['title', 'descriptionHtml', 'vendor', 'productType']) {
        if (isSet(fields[key])) input[key] = String(fields[key]);
    }
    const tags = isSet(fields.tags) ? client.tagList(fields.tags) : undefined;
    if (tags) input.tags = tags;
    if (isSet(fields.status)) input.status = String(fields.status).trim().toUpperCase();
    return input;
}

// Base64 image data → { buffer, mimeType, extension }. Accepts data URLs too.
function decodeAttachment(attachment) {

    const value = String(attachment).trim();
    const dataUrl = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    const buffer = Buffer.from(dataUrl ? dataUrl[3] : value, 'base64');
    if (!buffer.length) {
        throw new ShopifyError('Image attachment is empty or not valid base64 data.', 422);
    }
    const hex = buffer.subarray(0, 12).toString('hex');
    const ascii = buffer.subarray(0, 12).toString('latin1');
    let type = ['image/jpeg', 'jpg'];
    if (hex.startsWith('89504e47')) type = ['image/png', 'png'];
    else if (ascii.startsWith('GIF8')) type = ['image/gif', 'gif'];
    else if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') type = ['image/webp', 'webp'];
    else if (dataUrl && dataUrl[1] && dataUrl[1].startsWith('image/')) type = [dataUrl[1], dataUrl[1].split('/')[1]];
    return { buffer, mimeType: type[0], extension: type[1] };
}

// productUpdate/productDelete report a missing product as a userError; answer
// it as a 404 like Get does.
function checkProductErrors(payload, name) {

    const userErrors = (payload && payload.userErrors) || [];
    const notFound = userErrors.find(error => /does not exist|not found/i.test(error.message || ''));
    if (notFound) {
        throw new ShopifyError(`${name} failed — ${notFound.message}`, 404, userErrors);
    }
    return client.checkUserErrors(payload, name);
}

function isOnlineStore(publication) {

    const catalog = publication.catalog || {};
    const apps = nodes(catalog.apps);
    return apps.some(app => app.handle === ONLINE_STORE_HANDLE) || catalog.title === ONLINE_STORE_TITLE;
}

/**
 * @param {function} run (query, variables) => Promise<data>
 * @param {object} [options]
 * @param {function} [options.putFile] (url, buffer, headers) => Promise — uploads
 *        a staged file; required for base64 image attachments.
 * @param {function} [options.sleep] (ms) => Promise, for tests.
 */
module.exports = (run, options = {}) => {

    const sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));

    // A base64 image has no GraphQL input: stage an upload, PUT the bytes
    // there, then reference the staged resourceUrl as the media source.
    async function uploadAttachment(attachment) {

        if (typeof options.putFile !== 'function') {
            throw new ShopifyError('Image attachments (base64) need a file upload, which is not available here. Use an image URL instead.', 422);
        }
        const { buffer, mimeType, extension } = decodeAttachment(attachment);
        const data = await run(STAGED_UPLOAD, {
            input: [{ resource: 'IMAGE', filename: `image.${extension}`, mimeType, httpMethod: 'PUT', fileSize: String(buffer.length) }]
        });
        const payload = client.checkUserErrors(data.stagedUploadsCreate, 'stagedUploadsCreate');
        const target = payload.stagedTargets[0];
        // Only Content-Type is a signed header of the PUT target; sending the
        // other parameters (acl) as headers is rejected by the storage.
        await options.putFile(target.url, buffer, { 'Content-Type': mimeType });
        return target.resourceUrl;
    }

    // [{ url | attachment, alt }] → CreateMediaInput[] (undefined when empty).
    async function toMediaInput(images) {

        const media = [];
        for (const image of imageList(images)) {
            if (!image || (!isSet(image.url) && !isSet(image.attachment))) continue;
            const originalSource = isSet(image.url)
                ? String(image.url).trim()
                : await uploadAttachment(image.attachment);
            const item = { originalSource, mediaContentType: 'IMAGE' };
            if (isSet(image.alt)) item.alt = String(image.alt);
            media.push(item);
        }
        return media.length ? media : undefined;
    }

    async function getOrNull(id) {

        const data = await run(GET_PRODUCT, { id: toGid('Product', id) });
        return data.product ? flatten(data.product) : null;
    }

    async function get(id) {

        const product = await getOrNull(id);
        if (!product) {
            throw new ShopifyError(`Product ${id} not found.`, 404);
        }
        return product;
    }

    async function waitForMedia(product) {

        let current = product;
        for (let attempt = 0; attempt < MEDIA_WAIT_ATTEMPTS; attempt++) {
            if (!current.media.some(media => MEDIA_PENDING.includes(media.status))) break;
            await sleep(MEDIA_WAIT_MS);
            current = await get(current.id);
        }
        return current;
    }

    async function onlineStorePublicationId() {

        let after = null;
        do {
            const data = await run(PUBLICATIONS, { after });
            const found = nodes(data.publications).find(isOnlineStore);
            if (found) return found.id;
            const pageInfo = data.publications.pageInfo || {};
            after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
        } while (after);
        throw new ShopifyError('The store has no Online Store sales channel to publish the product to.', 422);
    }

    async function publishToOnlineStore(id) {

        const publicationId = await onlineStorePublicationId();
        const data = await run(PUBLISH, { id: toGid('Product', id), input: [{ publicationId }] });
        client.checkUserErrors(data.publishablePublish, 'publishablePublish');
    }

    return {

        get,
        getOrNull,
        publishToOnlineStore,
        onlineStorePublicationId,

        /**
         * Products matching the filters (see buildSearchQuery), up to `max`.
         * @param {object} [params] filters plus sortKey, reverse, max
         * @returns {Promise<object[]>}
         */
        async find(params = {}) {

            const { sortKey, reverse, max = FIND_MAX } = params;
            const query = buildSearchQuery(params);
            const products = [];
            let after = null;
            do {
                const data = await run(FIND_PRODUCTS, {
                    first: Math.min(FIND_PAGE_SIZE, max - products.length),
                    after,
                    query: query || null,
                    sortKey: sortKey || null,
                    reverse: !!reverse
                });
                products.push(...nodes(data.products).map(flatten));
                after = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
            } while (after && products.length < max);
            return products;
        },

        /**
         * The newest products by `sortKey` (CREATED_AT / UPDATED_AT), newest first.
         * @param {string} sortKey
         * @param {number} [first=1]
         * @returns {Promise<object[]>}
         */
        async recent(sortKey, first = 1) {

            const data = await run(FIND_PRODUCTS, { first, sortKey, reverse: true });
            return nodes(data.products).map(flatten);
        },

        async count(filters = {}) {

            const query = buildSearchQuery(filters);
            const data = await run(COUNT_PRODUCTS, { query: query || null });
            return data.productsCount.count;
        },

        /**
         * Create a product, optionally with images and published to the
         * Online Store. Returns the product as Get Product does.
         * @param {object} fields title, descriptionHtml, vendor, productType, tags, status,
         *        images [{ url | attachment, alt }], publishToOnlineStore
         * @returns {Promise<object>}
         */
        async create(fields = {}) {

            const variables = { product: toProductInput(fields) };
            const media = await toMediaInput(fields.images);
            if (media) variables.media = media;

            const data = await run(CREATE_PRODUCT, variables);
            const { product: created } = client.checkUserErrors(data.productCreate, 'productCreate');

            if (fields.publishToOnlineStore) {
                try {
                    await publishToOnlineStore(created.id);
                } catch (err) {
                    // Roll back: a retried message would otherwise create
                    // the product again next to the unpublished one.
                    await run(DELETE_PRODUCT, { input: { id: created.id } }).catch(() => {});
                    err.message = `Publishing the product to the Online Store failed, the product was not created: ${err.message}`;
                    throw err;
                }
            }
            return waitForMedia(await get(created.id));
        },

        /**
         * Update the given fields, add images, optionally publish to the Online Store.
         * @param {string} id gid or numeric id
         * @param {object} fields as for create
         */
        async update(id, fields = {}) {

            const gid = toGid('Product', id);
            const product = { ...toProductInput(fields), id: gid };
            const media = await toMediaInput(fields.images);
            if (Object.keys(product).length > 1 || media) {
                const variables = { product };
                if (media) variables.media = media;
                const data = await run(UPDATE_PRODUCT, variables);
                checkProductErrors(data.productUpdate, 'productUpdate');
            }
            if (fields.publishToOnlineStore) {
                await publishToOnlineStore(gid);
            }
        },

        async delete(id) {

            const data = await run(DELETE_PRODUCT, { input: { id: toGid('Product', id) } });
            checkProductErrors(data.productDelete, 'productDelete');
        }
    };
};

module.exports.flatten = flatten;
module.exports.buildSearchQuery = buildSearchQuery;
module.exports.toProductInput = toProductInput;
module.exports.imageList = imageList;
module.exports.decodeAttachment = decodeAttachment;
module.exports.productFields = productFields;
module.exports.PRODUCT_FIELDS = PRODUCT_FIELDS;
module.exports.queries = {
    GET_PRODUCT, FIND_PRODUCTS, COUNT_PRODUCTS, CREATE_PRODUCT, UPDATE_PRODUCT, DELETE_PRODUCT,
    STAGED_UPLOAD, PUBLICATIONS, PUBLISH
};

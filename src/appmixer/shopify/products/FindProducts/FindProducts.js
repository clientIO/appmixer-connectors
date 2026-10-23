'use strict';
const crypto = require('crypto');
const lib = require('../../lib');
const gqlProducts = require('../../gql-products');

const ITEM_SCHEMA = require('../../item-schema-products.json').product;

// Product pickers open several dropdowns at once; one fetch serves them all.
const SOURCE_CACHE_TTL_MS = 60 * 1000;

const FILTERS = [
    'query', 'vendor', 'productType', 'status', 'collectionId', 'tag',
    'createdAtMin', 'createdAtMax', 'updatedAtMin', 'updatedAtMax', 'sortKey', 'reverse'
];

function pick(content) {

    const params = {};
    for (const key of FILTERS) {
        if (content[key] !== undefined && content[key] !== null && content[key] !== '') {
            params[key] = content[key];
        }
    }
    return params;
}

async function findCached(context, params) {

    const key = 'shopify-products-source-' + crypto.createHash('sha256')
        .update(JSON.stringify({ store: context.auth.store, token: context.auth.accessToken, params }))
        .digest('hex');
    let lock;
    try {
        lock = await context.lock(key, { ttl: 30000, retryDelay: 500, maxRetryCount: 60 });
        const cached = await context.staticCache.get(key);
        if (cached) return cached;
        const products = await gqlProducts(lib.runner(context)).find(params);
        await context.staticCache.set(key, products, SOURCE_CACHE_TTL_MS);
        return products;
    } finally {
        if (lock) await lock.unlock();
    }
}

// The transforms get the `out` message: { result: [...] } for the array
// output type, or an array.
function productsOf(out) {

    if (Array.isArray(out)) return out;
    return (out && Array.isArray(out.result)) ? out.result : [];
}

/**
 * Find products by a search query and typed filters.
 * @extends {Component}
 */
module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const content = context.messages.in.content;
        const outputType = content.outputType || 'array';

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Products' });
        }

        const params = pick(content);

        if (context.properties.isSource) {
            try {
                const products = await findCached(context, params);
                return context.sendJson({ result: products, count: products.length }, 'out');
            } catch (err) {
                await context.log({ step: 'source-call-failed', error: err.message });
                return context.sendJson({ result: [], count: 0 }, 'out');
            }
        }

        const products = await gqlProducts(lib.runner(context)).find(params);
        if (!products.length) {
            return context.sendJson({}, 'notFound');
        }
        return lib.sendArrayOutput({ context, outputType, records: products });
    },

    productsToSelectArray(out) {

        return productsOf(out).map(product => ({ label: product.title, value: product.id }));
    },

    // value = ProductVariant gid; label "Product — Variant" (the product title
    // alone for a product with only the default variant).
    variantsToSelectArray(out) {

        const variants = [];
        productsOf(out).forEach(product => {
            (product.variants || []).forEach(variant => {
                variants.push({
                    value: variant.id,
                    label: product.hasOnlyDefaultVariant || variant.title === 'Default Title'
                        ? product.title
                        : `${product.title} — ${variant.title}`
                });
            });
        });
        return variants;
    }
};

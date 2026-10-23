'use strict';

// GraphQL Admin API client shared by the resource modules (gql-*.js).
//
// The connector's components were written against the REST Admin API and keep
// its object shapes (snake_case keys, numeric ids). The resource modules query
// GraphQL and map the result back to those shapes; this file holds what they
// share: the request with throttle handling, error normalisation, global id
// conversion and cursor pagination.

const API_VERSION = '2026-10';
const MAX_THROTTLE_RETRIES = 5;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Error carrying an HTTP-like status, so callers that branched on the REST
 * client's `err.statusCode` (404, 403, 422) keep working.
 */
class ShopifyError extends Error {

    constructor(message, statusCode, details) {

        super(message);
        this.name = 'ShopifyError';
        this.statusCode = statusCode;
        this.statusMessage = message;
        if (details) {
            this.details = details;
        }
    }
}

// GraphQL answers HTTP 200 with an `errors` array; translate the codes that
// matter to the status the REST API would have answered with.
function statusFromErrors(errors) {

    const codes = errors.map(error => error.extensions && error.extensions.code);
    if (codes.includes('ACCESS_DENIED')) return 403;
    if (codes.includes('NOT_FOUND')) return 404;
    if (codes.includes('THROTTLED')) return 429;
    return 400;
}

/**
 * Run a GraphQL query or mutation and return its `data`. Retries when Shopify
 * throttles the request (cost-based limit), waiting until enough points are
 * restored for the query.
 * @param {Context} context
 * @param {string} query
 * @param {object} [variables]
 * @param {function} request low-level request ({ method, path, body, apiVersion }) => { data, headers }
 * @returns {Promise<object>}
 */
async function gql(context, query, variables, request) {

    for (let attempt = 0; ; attempt++) {
        const body = variables ? { query, variables } : { query };
        const { data: response } = await request(context, { method: 'POST', path: 'graphql.json', body, apiVersion: API_VERSION });

        const errors = (response && response.errors) || [];
        if (!errors.length) {
            return response.data;
        }

        const status = statusFromErrors(errors);
        if (status === 429 && attempt < MAX_THROTTLE_RETRIES) {
            const cost = response.extensions && response.extensions.cost;
            const throttle = cost && cost.throttleStatus;
            const missing = throttle ? Math.max(0, cost.requestedQueryCost - throttle.currentlyAvailable) : 50;
            const rate = (throttle && throttle.restoreRate) || 50;
            await sleep(Math.ceil((missing / rate) * 1000) + 250);
            continue;
        }

        throw new ShopifyError(errors.map(error => error.message).join('; '), status, errors);
    }
}

/**
 * Throw when a mutation payload reports userErrors (the GraphQL counterpart of
 * a REST 422). Returns the payload otherwise.
 * @param {object} payload the mutation's payload object (e.g. data.customerCreate)
 * @param {string} name mutation name, for the message
 * @returns {object}
 */
function checkUserErrors(payload, name) {

    const userErrors = (payload && payload.userErrors) || [];
    if (userErrors.length) {
        const message = userErrors.map(error => {
            const field = Array.isArray(error.field) && error.field.length ? `${error.field.join('.')}: ` : '';
            return field + error.message;
        }).join('; ');
        throw new ShopifyError(`${name} failed — ${message}`, 422, userErrors);
    }
    return payload;
}

/**
 * gid://shopify/Customer/123 → 123 (a number, as in the REST API). Values that
 * are not global ids are returned unchanged.
 * @param {string} gid
 * @returns {number|string|null}
 */
function fromGid(gid) {

    if (gid === null || gid === undefined) {
        return null;
    }
    const match = String(gid).match(/^gid:\/\/shopify\/[A-Za-z]+\/(\d+)/);
    if (!match) {
        return gid;
    }
    const number = Number(match[1]);
    return Number.isSafeInteger(number) ? number : match[1];
}

/**
 * 123 or '123' → gid://shopify/<type>/123. A value that already is a global id
 * is returned unchanged.
 * @param {string} type GraphQL object type, e.g. 'Customer'
 * @param {number|string} id
 * @returns {string}
 */
function toGid(type, id) {

    if (id === null || id === undefined || id === '') {
        return id;
    }
    const value = String(id).trim();
    return value.startsWith('gid://') ? value : `gid://shopify/${type}/${value}`;
}

/**
 * Build a REST-style list result: an array with a non-enumerable
 * `nextPageParameters` the pager feeds back to the list function.
 * @param {Array} items
 * @param {object} pageInfo GraphQL pageInfo { hasNextPage, endCursor }
 * @param {object} params the list parameters the page was fetched with
 * @returns {Array}
 */
function toListResult(items, pageInfo, params = {}) {

    const result = Array.isArray(items) ? items.slice() : [];
    const next = pageInfo && pageInfo.hasNextPage && pageInfo.endCursor
        ? { ...params, after: pageInfo.endCursor }
        : undefined;
    Object.defineProperty(result, 'nextPageParameters', { value: next, enumerable: false });
    return result;
}

/**
 * REST `limit` → GraphQL `first` (1..250, default 50 like REST).
 * @param {number|string} limit
 * @returns {number}
 */
function pageSize(limit) {

    const value = parseInt(limit, 10);
    if (!Number.isFinite(value) || value < 1) return 50;
    return Math.min(value, 250);
}

/**
 * Money from a MoneyBag/MoneyV2 → REST decimal string ("19.99").
 * @param {object} money { amount } or { shopMoney: { amount } }
 * @returns {string|null}
 */
function money(money) {

    if (!money) return null;
    const value = money.shopMoney ? money.shopMoney.amount : money.amount;
    return value === null || value === undefined ? null : String(value);
}

/**
 * GraphQL enum (PARTIALLY_PAID) → REST value (partially_paid).
 * @param {string} value
 * @returns {string|null}
 */
function enumValue(value) {

    return value === null || value === undefined ? null : String(value).toLowerCase();
}

/**
 * MailingAddress → REST address object.
 * @param {object} address
 * @returns {object|null}
 */
function address(address) {

    if (!address) return null;
    return {
        id: fromGid(address.id),
        first_name: address.firstName,
        last_name: address.lastName,
        name: address.name,
        company: address.company,
        address1: address.address1,
        address2: address.address2,
        city: address.city,
        province: address.province,
        country: address.country,
        zip: address.zip,
        phone: address.phone,
        province_code: address.provinceCode,
        country_code: address.countryCodeV2,
        country_name: address.country,
        latitude: address.latitude,
        longitude: address.longitude
    };
}

// GraphQL selection matching address() above.
const ADDRESS_FIELDS = `id firstName lastName name company address1 address2 city province country zip phone
    provinceCode countryCodeV2 latitude longitude`;

/**
 * REST address payload → MailingAddressInput. Keys left out of the payload stay
 * out of the input. GraphQL takes the country and province only as codes
 * (CZ, ON); REST also accepted names, which now fail with a clear message
 * instead of being dropped.
 * @param {object} payload
 * @returns {object|undefined}
 */
function addressInput(payload) {

    if (!payload || typeof payload !== 'object') return undefined;
    const map = {
        first_name: 'firstName', last_name: 'lastName', company: 'company', address1: 'address1',
        address2: 'address2', city: 'city', province_code: 'provinceCode', province: 'provinceCode',
        country_code: 'countryCode', country: 'countryCode', zip: 'zip', phone: 'phone'
    };
    const input = {};
    for (const [key, target] of Object.entries(map)) {
        let value = payload[key];
        if (value === undefined || value === null || String(value).trim() === '') continue;
        if (input[target] !== undefined) continue;
        value = String(value).trim();
        if (target === 'countryCode') {
            if (!/^[A-Za-z]{2}$/.test(value)) {
                throw new ShopifyError(`Country must be a two-letter ISO code (for example CZ or US), got "${value}".`, 422);
            }
            value = value.toUpperCase();
        }
        if (target === 'provinceCode') {
            if (!/^[A-Za-z0-9]{1,3}$/.test(value)) {
                throw new ShopifyError(`Province must be a province or state code (for example ON or CA), got "${value}".`, 422);
            }
            value = value.toUpperCase();
        }
        input[target] = value;
    }
    return Object.keys(input).length ? input : undefined;
}

/**
 * REST `tags` ("a, b") or array → GraphQL [String].
 * @param {string|string[]} tags
 * @returns {string[]|undefined}
 */
function tagList(tags) {

    if (tags === undefined || tags === null) return undefined;
    if (Array.isArray(tags)) return tags.map(String).map(tag => tag.trim()).filter(Boolean);
    return String(tags).split(',').map(tag => tag.trim()).filter(Boolean);
}

/**
 * GraphQL [String] tags → REST comma-separated string.
 * @param {string[]} tags
 * @returns {string}
 */
function tagString(tags) {

    return Array.isArray(tags) ? tags.join(', ') : (tags || '');
}

module.exports = {
    API_VERSION,
    ShopifyError,
    gql,
    checkUserErrors,
    fromGid,
    toGid,
    toListResult,
    pageSize,
    money,
    enumValue,
    address,
    ADDRESS_FIELDS,
    addressInput,
    tagList,
    tagString
};

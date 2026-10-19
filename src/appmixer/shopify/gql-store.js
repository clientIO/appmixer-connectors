'use strict';

// Abandoned checkouts, draft orders, inventory levels and returns on the
// GraphQL Admin API, read by the store-level triggers. Objects are returned as
// GraphQL returns them (camelCase fields, global ids, MoneyBag amounts); the
// only reshaping is that connections become plain arrays.

const client = require('./graphql-client');

const ADDRESS_FIELDS = `id firstName lastName company address1 address2 city province provinceCode
    country countryCodeV2 zip phone`;

const MONEY_BAG = 'shopMoney { amount currencyCode }';

const CUSTOMER_REF = `id legacyResourceId displayName
    defaultEmailAddress { emailAddress }
    defaultPhoneNumber { phoneNumber }`;

const CHECKOUT_FIELDS = `
    id name abandonedCheckoutUrl createdAt updatedAt completedAt note taxesIncluded discountCodes
    customAttributes { key value }
    subtotalPriceSet { ${MONEY_BAG} }
    totalDiscountSet { ${MONEY_BAG} }
    totalLineItemsPriceSet { ${MONEY_BAG} }
    totalTaxSet { ${MONEY_BAG} }
    totalPriceSet { ${MONEY_BAG} }
    customer { ${CUSTOMER_REF} }
    shippingAddress { ${ADDRESS_FIELDS} }
    billingAddress { ${ADDRESS_FIELDS} }
    lineItems(first: 50) {
        nodes {
            id title variantTitle sku quantity
            originalUnitPriceSet { ${MONEY_BAG} }
            originalTotalPriceSet { ${MONEY_BAG} }
            discountedTotalPriceSet { ${MONEY_BAG} }
            product { id title }
            variant { id title }
        }
    }`;

const DRAFT_ORDER_FIELDS = `
    id legacyResourceId name status email phone note2 tags poNumber taxExempt taxesIncluded
    currencyCode presentmentCurrencyCode invoiceUrl invoiceSentAt reserveInventoryUntil
    totalQuantityOfLineItems createdAt updatedAt completedAt
    order { id legacyResourceId name }
    customer { ${CUSTOMER_REF} }
    customAttributes { key value }
    appliedDiscount { title description value valueType amountSet { ${MONEY_BAG} } }
    shippingLine { title code custom originalPriceSet { ${MONEY_BAG} } }
    taxLines { title rate priceSet { ${MONEY_BAG} } }
    subtotalPriceSet { ${MONEY_BAG} }
    totalDiscountsSet { ${MONEY_BAG} }
    totalShippingPriceSet { ${MONEY_BAG} }
    totalTaxSet { ${MONEY_BAG} }
    totalPriceSet { ${MONEY_BAG} }
    shippingAddress { ${ADDRESS_FIELDS} }
    billingAddress { ${ADDRESS_FIELDS} }
    lineItems(first: 50) {
        nodes {
            id name title variantTitle sku vendor quantity custom requiresShipping taxable isGiftCard
            originalUnitPriceSet { ${MONEY_BAG} }
            originalTotalSet { ${MONEY_BAG} }
            discountedTotalSet { ${MONEY_BAG} }
            appliedDiscount { title description value valueType amountSet { ${MONEY_BAG} } }
            product { id title }
            variant { id title }
        }
    }`;

const INVENTORY_LEVEL_FIELDS = `
    id isActive createdAt updatedAt
    quantities(names: ["available", "on_hand", "committed", "incoming", "reserved"]) { name quantity }
    item {
        id legacyResourceId sku tracked
        variants(first: 1) { nodes { id legacyResourceId title displayName product { id title } } }
    }
    location { id legacyResourceId name }`;

const RETURN_FIELDS = `
    id name status totalQuantity createdAt requestApprovedAt closedAt
    order { id legacyResourceId name }
    decline { reason note }
    returnLineItems(first: 50) {
        nodes {
            id quantity customerNote returnReasonNote
            returnReasonDefinition { handle name }
            ... on ReturnLineItem { fulfillmentLineItem { id lineItem { id name } } }
        }
    }
    reverseFulfillmentOrders(first: 10) { nodes { id status } }`;

const GET_CHECKOUT = `query GetAbandonedCheckout($id: ID!) {
    node(id: $id) { ... on AbandonedCheckout { ${CHECKOUT_FIELDS} } }
}`;

// With 50 line items each, a page of 50 checkouts costs about 210 query points (max 1000).
const CHECKOUT_PAGE_SIZE = 50;

const LIST_CHECKOUTS = `query ListAbandonedCheckouts($first: Int!, $after: String) {
    abandonedCheckouts(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
        nodes { ${CHECKOUT_FIELDS} }
        pageInfo { hasNextPage endCursor }
    }
}`;

const GET_DRAFT_ORDER = `query GetDraftOrder($id: ID!) {
    draftOrder(id: $id) { ${DRAFT_ORDER_FIELDS} }
}`;

const LATEST_DRAFT_ORDER = `query LatestDraftOrder($sortKey: DraftOrderSortKeys!) {
    draftOrders(first: 1, sortKey: $sortKey, reverse: true) { nodes { ${DRAFT_ORDER_FIELDS} } }
}`;

const GET_INVENTORY_LEVEL = `query GetInventoryLevel($id: ID!) {
    inventoryLevel(id: $id) { ${INVENTORY_LEVEL_FIELDS} }
}`;

const INVENTORY_LEVEL_BY_ITEM = `query InventoryLevelByItem($itemId: ID!, $locationId: ID!) {
    inventoryItem(id: $itemId) { inventoryLevel(locationId: $locationId) { ${INVENTORY_LEVEL_FIELDS} } }
}`;

// Inventory items have no updated-at sort; the newest item's first level is
// a recent, real level of the store.
const LATEST_INVENTORY_LEVEL = `query LatestInventoryLevel {
    inventoryItems(first: 1, reverse: true) {
        nodes { inventoryLevels(first: 1) { nodes { ${INVENTORY_LEVEL_FIELDS} } } }
    }
}`;

const GET_RETURN = `query GetReturn($id: ID!) {
    return(id: $id) { ${RETURN_FIELDS} }
}`;

// There is no top-level returns query: look at the recently updated orders
// that have a return and take their newest return.
const RECENT_RETURNS = `query RecentReturns {
    orders(first: 10, sortKey: UPDATED_AT, reverse: true, query: "-return_status:no_return") {
        nodes { returns(first: 1, reverse: true) { nodes { id createdAt } } }
    }
}`;

function nodes(connection) {

    return connection && connection.nodes ? connection.nodes : [];
}

// connection { nodes } → array for the connection fields of each object.
function flattenCheckout(checkout) {

    if (!checkout) return null;
    return { ...checkout, lineItems: nodes(checkout.lineItems) };
}

function flattenDraftOrder(draftOrder) {

    if (!draftOrder) return null;
    return { ...draftOrder, lineItems: nodes(draftOrder.lineItems) };
}

function flattenInventoryLevel(level) {

    if (!level) return null;
    return { ...level, item: { ...level.item, variants: nodes(level.item && level.item.variants) } };
}

function flattenReturn(ret) {

    if (!ret) return null;
    return {
        ...ret,
        returnLineItems: nodes(ret.returnLineItems),
        reverseFulfillmentOrders: nodes(ret.reverseFulfillmentOrders)
    };
}

module.exports = (run) => ({

    /**
     * An abandoned checkout by id. The checkouts/* webhooks carry the same
     * numeric id. Null until Shopify lists the checkout as abandoned.
     * @param {string|number} id AbandonedCheckout gid or numeric id
     * @returns {Promise<object|null>}
     */
    async getCheckout(id) {

        const data = await run(GET_CHECKOUT, { id: client.toGid('AbandonedCheckout', id) });
        return data.node && data.node.id ? flattenCheckout(data.node) : null;
    },

    /**
     * Abandoned checkouts, newest first, up to `max`.
     * @param {object} [params]
     * @param {number} [params.max=250]
     * @returns {Promise<object[]>}
     */
    async listCheckouts({ max = 250 } = {}) {

        const checkouts = [];
        let after = null;
        do {
            const data = await run(LIST_CHECKOUTS, {
                first: Math.min(CHECKOUT_PAGE_SIZE, max - checkouts.length),
                after
            });
            checkouts.push(...data.abandonedCheckouts.nodes.map(flattenCheckout));
            const pageInfo = data.abandonedCheckouts.pageInfo;
            after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
        } while (after && checkouts.length < max);
        return checkouts;
    },

    /**
     * @param {string|number} id DraftOrder gid or numeric id
     * @returns {Promise<object|null>} null when the draft order does not exist (any more)
     */
    async getDraftOrder(id) {

        const data = await run(GET_DRAFT_ORDER, { id: client.toGid('DraftOrder', id) });
        return flattenDraftOrder(data.draftOrder);
    },

    /**
     * The newest draft order by creation (ID) or by last update (UPDATED_AT).
     * @param {'ID'|'UPDATED_AT'} sortKey
     * @returns {Promise<object|null>}
     */
    async latestDraftOrder(sortKey) {

        const data = await run(LATEST_DRAFT_ORDER, { sortKey });
        return flattenDraftOrder(data.draftOrders.nodes[0]);
    },

    /**
     * An inventory level by its gid (gid://shopify/InventoryLevel/1?inventory_item_id=2),
     * or by inventory item and location when no gid is at hand.
     * @param {object} params
     * @param {string} [params.id]
     * @param {string|number} [params.inventoryItemId]
     * @param {string|number} [params.locationId]
     * @returns {Promise<object|null>}
     */
    async getInventoryLevel({ id, inventoryItemId, locationId }) {

        if (id) {
            const data = await run(GET_INVENTORY_LEVEL, { id });
            return flattenInventoryLevel(data.inventoryLevel);
        }
        const data = await run(INVENTORY_LEVEL_BY_ITEM, {
            itemId: client.toGid('InventoryItem', inventoryItemId),
            locationId: client.toGid('Location', locationId)
        });
        return flattenInventoryLevel(data.inventoryItem && data.inventoryItem.inventoryLevel);
    },

    /**
     * A recent inventory level of the store.
     * @returns {Promise<object|null>}
     */
    async latestInventoryLevel() {

        const data = await run(LATEST_INVENTORY_LEVEL);
        const item = data.inventoryItems.nodes[0];
        return item ? flattenInventoryLevel(nodes(item.inventoryLevels)[0]) : null;
    },

    /**
     * @param {string|number} id Return gid or numeric id
     * @returns {Promise<object|null>}
     */
    async getReturn(id) {

        const data = await run(GET_RETURN, { id: client.toGid('Return', id) });
        return flattenReturn(data.return);
    },

    /**
     * The newest return of the recently updated orders.
     * @returns {Promise<object|null>}
     */
    async latestReturn() {

        const data = await run(RECENT_RETURNS);
        const latest = data.orders.nodes
            .map(order => nodes(order.returns)[0])
            .filter(Boolean)
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
        return latest ? this.getReturn(latest.id) : null;
    }
});

/**
 * The `fetch` of the checkouts/* webhook triggers. The payload carries the
 * numeric checkout id, which is the id of the AbandonedCheckout. GraphQL has
 * no other checkout object, and Shopify returns a checkout only once it holds
 * contact details and is left unpaid for a while — until then the trigger
 * emits the checkout id alone rather than nothing.
 * @param {object} api gql-store bound to a runner
 * @returns {function} (gid, payload) => Promise<object>
 */
module.exports.checkoutFetcher = api => async (gid, payload = {}) => {

    // A checkout gets its id only once Shopify lists it (after the buyer
    // entered contact details); until then the payload carries the token alone.
    const id = payload.id !== undefined && payload.id !== null ? payload.id : client.fromGid(gid);
    const checkout = id ? await api.getCheckout(id) : null;
    return checkout
        ? { ...checkout, token: payload.token || null }
        : { id: id ? client.toGid('AbandonedCheckout', id) : null, token: payload.token || null };
};

// Payload fields the checkout triggers need besides the ids.
module.exports.CHECKOUT_WEBHOOK_FIELDS = ['token'];

module.exports.CHECKOUT_FIELDS = CHECKOUT_FIELDS;
module.exports.DRAFT_ORDER_FIELDS = DRAFT_ORDER_FIELDS;
module.exports.INVENTORY_LEVEL_FIELDS = INVENTORY_LEVEL_FIELDS;
module.exports.RETURN_FIELDS = RETURN_FIELDS;

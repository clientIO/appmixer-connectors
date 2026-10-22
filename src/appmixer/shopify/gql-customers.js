'use strict';

// Customers on the GraphQL Admin API. Objects are returned as GraphQL returns
// them (camelCase fields, global ids); the only reshaping is that connections
// become plain arrays (`addresses: [...]` instead of `{ nodes: [...] }`).

const client = require('./graphql-client');

const ADDRESS_FIELDS = `id firstName lastName company address1 address2 city province provinceCode
    country countryCodeV2 zip phone`;

const CUSTOMER_FIELDS = `
    id legacyResourceId displayName firstName lastName note tags state locale verifiedEmail
    taxExempt taxExemptions numberOfOrders createdAt updatedAt
    amountSpent { amount currencyCode }
    defaultEmailAddress { emailAddress marketingState marketingOptInLevel marketingUpdatedAt }
    defaultPhoneNumber { phoneNumber smsMarketingConsent { state optInLevel updatedAt } }
    defaultAddress { ${ADDRESS_FIELDS} }
    addresses: addressesV2(first: 50) { nodes { ${ADDRESS_FIELDS} } }
    lastOrder { id name }
    metafields(first: 20) { nodes { namespace key type value } }`;

const GET_CUSTOMER = `query GetCustomer($id: ID!) {
    customer(id: $id) { ${CUSTOMER_FIELDS} }
}`;

const FIND_CUSTOMERS = `query FindCustomers($first: Int!, $after: String, $query: String, $sortKey: CustomerSortKeys, $reverse: Boolean) {
    customers(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
        nodes { ${CUSTOMER_FIELDS} }
        pageInfo { hasNextPage endCursor }
    }
}`;

// customersCount only understands the id, created_at and updated_at search
// fields; any other field is ignored and everything is counted.
const COUNT_CUSTOMERS = `query CountCustomers($query: String) {
    customersCount(query: $query, limit: null) { count }
}`;

const CREATE_CUSTOMER = `mutation CreateCustomer($input: CustomerInput!) {
    customerCreate(input: $input) { customer { id } userErrors { field message } }
}`;

const UPDATE_CUSTOMER = `mutation UpdateCustomer($input: CustomerInput!) {
    customerUpdate(input: $input) { customer { id } userErrors { field message } }
}`;

const UPDATE_EMAIL_MARKETING_CONSENT = `mutation UpdateEmailMarketingConsent($input: CustomerEmailMarketingConsentUpdateInput!) {
    customerEmailMarketingConsentUpdate(input: $input) { customer { id } userErrors { field message } }
}`;

const DELETE_CUSTOMER = `mutation DeleteCustomer($input: CustomerDeleteInput!) {
    customerDelete(input: $input) { deletedCustomerId userErrors { field message } }
}`;

const CREATE_ADDRESS = `mutation CreateCustomerAddress($customerId: ID!, $address: MailingAddressInput!, $setAsDefault: Boolean) {
    customerAddressCreate(customerId: $customerId, address: $address, setAsDefault: $setAsDefault) {
        address { id } userErrors { field message }
    }
}`;

// connection { nodes } → array, for the fields that are connections.
function flatten(customer) {

    if (!customer) return customer;
    return {
        ...customer,
        addresses: customer.addresses ? customer.addresses.nodes : [],
        metafields: customer.metafields ? customer.metafields.nodes : []
    };
}

function isSet(value) {

    return value !== undefined && value !== null && String(value).trim() !== '';
}

// Quote a value for the search syntax: 'a b' → "a b".
function quote(value) {

    return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Typed Find filters → customer search query, ANDed with the free-form query.
 * @param {object} filters
 * @returns {string|null}
 */
function buildSearchQuery({ query, email, phone, tag, createdAtMin, updatedAtMin } = {}) {

    const terms = [];
    if (isSet(query)) terms.push(`(${String(query).trim()})`);
    if (isSet(email)) terms.push(`email:${quote(String(email).trim())}`);
    if (isSet(phone)) terms.push(`phone:${quote(String(phone).trim())}`);
    if (isSet(tag)) terms.push(`tag:${quote(String(tag).trim())}`);
    if (isSet(createdAtMin)) terms.push(`customer_date:>=${quote(new Date(createdAtMin).toISOString())}`);
    if (isSet(updatedAtMin)) terms.push(`updated_at:>=${quote(new Date(updatedAtMin).toISOString())}`);
    return terms.length ? terms.join(' AND ') : null;
}

/**
 * Count filters → customersCount search query (created_at / updated_at only).
 * @param {object} filters
 * @returns {string|null}
 */
function buildCountQuery({ createdAtMin, createdAtMax, updatedAtMin, updatedAtMax } = {}) {

    const terms = [];
    if (isSet(createdAtMin)) terms.push(`created_at:>=${quote(new Date(createdAtMin).toISOString())}`);
    if (isSet(createdAtMax)) terms.push(`created_at:<=${quote(new Date(createdAtMax).toISOString())}`);
    if (isSet(updatedAtMin)) terms.push(`updated_at:>=${quote(new Date(updatedAtMin).toISOString())}`);
    if (isSet(updatedAtMax)) terms.push(`updated_at:<=${quote(new Date(updatedAtMax).toISOString())}`);
    return terms.length ? terms.join(' AND ') : null;
}

/**
 * Sort input ('UPDATED_AT_DESC', 'NAME_ASC', 'RELEVANCE') → { sortKey, reverse }.
 * @param {string} sort
 * @returns {{sortKey: string|null, reverse: boolean}}
 */
function parseSort(sort) {

    if (!isSet(sort)) return { sortKey: null, reverse: false };
    const match = String(sort).trim().toUpperCase().match(/^(.+?)(?:_(ASC|DESC))?$/);
    return { sortKey: match[1], reverse: match[2] === 'DESC' };
}

/**
 * Component inputs → CustomerInput. Empty values are left out, so an update
 * changes only the fields that were filled in.
 * @param {object} fields
 * @returns {object}
 */
function customerInput(fields = {}) {

    const input = {};
    for (const key of ['firstName', 'lastName', 'email', 'phone', 'note', 'locale']) {
        if (isSet(fields[key])) input[key] = String(fields[key]).trim();
    }
    if (isSet(fields.tags) || Array.isArray(fields.tags)) {
        input.tags = client.tagList(fields.tags);
    }
    if (typeof fields.taxExempt === 'boolean') {
        input.taxExempt = fields.taxExempt;
    }
    const exemptions = client.tagList(fields.taxExemptions);
    if (exemptions && exemptions.length) {
        input.taxExemptions = exemptions;
    }
    const metafields = (Array.isArray(fields.metafields) ? fields.metafields : [])
        .filter(metafield => metafield && isSet(metafield.key))
        .map(metafield => ({
            namespace: isSet(metafield.namespace) ? String(metafield.namespace).trim() : undefined,
            key: String(metafield.key).trim(),
            type: isSet(metafield.type) ? metafield.type : 'single_line_text_field',
            value: metafield.value === undefined || metafield.value === null ? '' : String(metafield.value)
        }));
    if (metafields.length) {
        input.metafields = metafields;
    }
    return input;
}

/**
 * Address inputs → MailingAddressInput, or undefined when no address field
 * other than the name or phone is filled in. Country and province are codes.
 * @param {object} address
 * @returns {object|undefined}
 */
function mailingAddressInput(address = {}) {

    const input = {};
    for (const key of ['firstName', 'lastName', 'company', 'address1', 'address2', 'city', 'zip', 'phone']) {
        if (isSet(address[key])) input[key] = String(address[key]).trim();
    }
    if (isSet(address.countryCode)) {
        const code = String(address.countryCode).trim();
        if (!/^[A-Za-z]{2}$/.test(code)) {
            throw new client.ShopifyError(`Country must be a two-letter ISO code (for example CZ or US), got "${code}".`, 422);
        }
        input.countryCode = code.toUpperCase();
    }
    if (isSet(address.provinceCode)) {
        const code = String(address.provinceCode).trim();
        if (!/^[A-Za-z0-9]{1,3}$/.test(code)) {
            throw new client.ShopifyError(`Province must be a province or state code (for example ON or CA), got "${code}".`, 422);
        }
        input.provinceCode = code.toUpperCase();
    }
    const hasAddress = Object.keys(input).some(key => !['firstName', 'lastName', 'phone'].includes(key));
    return hasAddress ? input : undefined;
}

/**
 * Email marketing consent for a subscribed / unsubscribed choice.
 * @param {boolean} subscribed
 * @returns {object}
 */
function emailMarketingConsent(subscribed) {

    return {
        marketingState: subscribed ? 'SUBSCRIBED' : 'UNSUBSCRIBED',
        marketingOptInLevel: 'SINGLE_OPT_IN',
        consentUpdatedAt: new Date().toISOString()
    };
}

/**
 * Whether the customer's last update came later than `thresholdMs` after it
 * was created. Creating a customer with an address is followed by an update
 * (the address) within a second; that one is not a change of its own.
 * @param {object} customer
 * @param {number} [thresholdMs=2000]
 * @returns {boolean}
 */
function updatedAfterCreate(customer, thresholdMs = 2000) {

    return Date.parse(customer.updatedAt) > Date.parse(customer.createdAt) + thresholdMs;
}

module.exports = (run) => {

    async function get(id) {

        const data = await run(GET_CUSTOMER, { id: client.toGid('Customer', id) });
        if (!data.customer) {
            throw new client.ShopifyError(`Customer ${id} not found.`, 404);
        }
        return flatten(data.customer);
    }

    async function remove(id) {

        const data = await run(DELETE_CUSTOMER, { input: { id: client.toGid('Customer', id) } });
        client.checkUserErrors(data.customerDelete, 'customerDelete');
    }

    return {

        get,

        /**
         * The customer, or null when it does not exist (any more).
         * @param {string} id gid or numeric id
         */
        async getOrNull(id) {

            const data = await run(GET_CUSTOMER, { id: client.toGid('Customer', id) });
            return data.customer ? flatten(data.customer) : null;
        },

        /**
         * Customers matching a Shopify search query, up to `max` of them.
         * @param {object} params
         * @param {string} [params.query] Shopify customer search syntax; empty = all customers
         * @param {string} [params.sortKey] CustomerSortKeys value
         * @param {boolean} [params.reverse]
         * @param {number} [params.max=250]
         */
        async find({ query, sortKey, reverse, max = 250 } = {}) {

            const customers = [];
            let after = null;
            do {
                const data = await run(FIND_CUSTOMERS, {
                    first: Math.min(100, max - customers.length),
                    after,
                    query: query || null,
                    sortKey: sortKey || null,
                    reverse: !!reverse
                });
                customers.push(...data.customers.nodes.map(flatten));
                after = data.customers.pageInfo.hasNextPage ? data.customers.pageInfo.endCursor : null;
            } while (after && customers.length < max);
            return customers;
        },

        async count(query) {

            const data = await run(COUNT_CUSTOMERS, { query: query || null });
            return data.customersCount.count;
        },

        /**
         * Create a customer, add the address as its default one and return the
         * customer. When the address is rejected the customer is deleted again,
         * so a retry does not hit "email has already been taken".
         * @param {object} fields CustomerInput fields (see customerInput)
         * @param {object} [options]
         * @param {object} [options.address] MailingAddressInput fields
         * @param {boolean} [options.acceptsEmailMarketing]
         */
        async create(fields, { address, acceptsEmailMarketing } = {}) {

            const input = customerInput(fields);
            const addressInput = mailingAddressInput(address);
            if (!input.firstName && !input.lastName && !input.email && !input.phone) {
                throw new client.ShopifyError('A customer needs a first name, last name, email or phone.', 422);
            }
            if (acceptsEmailMarketing === true) {
                if (!input.email) {
                    throw new client.ShopifyError('Email marketing consent needs an email address.', 422);
                }
                input.emailMarketingConsent = emailMarketingConsent(true);
            }

            const data = await run(CREATE_CUSTOMER, { input });
            const { customer } = client.checkUserErrors(data.customerCreate, 'customerCreate');

            if (addressInput) {
                try {
                    const created = await run(CREATE_ADDRESS, {
                        customerId: customer.id,
                        address: addressInput,
                        setAsDefault: true
                    });
                    client.checkUserErrors(created.customerAddressCreate, 'customerAddressCreate');
                } catch (err) {
                    await remove(customer.id).catch(() => {});
                    throw err;
                }
            }
            return get(customer.id);
        },

        /**
         * Update the filled-in fields of a customer.
         * @param {string} id gid or numeric id
         * @param {object} fields CustomerInput fields (see customerInput)
         * @param {object} [options]
         * @param {string} [options.emailMarketingState] SUBSCRIBED | UNSUBSCRIBED
         */
        async update(id, fields, { emailMarketingState } = {}) {

            const customerId = client.toGid('Customer', id);
            const input = customerInput(fields);
            if (Object.keys(input).length) {
                const data = await run(UPDATE_CUSTOMER, { input: { ...input, id: customerId } });
                client.checkUserErrors(data.customerUpdate, 'customerUpdate');
            }
            if (isSet(emailMarketingState)) {
                const data = await run(UPDATE_EMAIL_MARKETING_CONSENT, {
                    input: {
                        customerId,
                        emailMarketingConsent: emailMarketingConsent(String(emailMarketingState).toUpperCase() === 'SUBSCRIBED')
                    }
                });
                client.checkUserErrors(data.customerEmailMarketingConsentUpdate, 'customerEmailMarketingConsentUpdate');
            }
        },

        delete: remove
    };
};

module.exports.CUSTOMER_FIELDS = CUSTOMER_FIELDS;
module.exports.buildSearchQuery = buildSearchQuery;
module.exports.buildCountQuery = buildCountQuery;
module.exports.parseSort = parseSort;
module.exports.customerInput = customerInput;
module.exports.mailingAddressInput = mailingAddressInput;
module.exports.updatedAfterCreate = updatedAfterCreate;

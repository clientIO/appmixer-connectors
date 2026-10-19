const assert = require('assert');
const gqlCustomers = require('../../gql-customers');
const ITEM_SCHEMAS = require('../../item-schema-customers.json');

// A customer as the GraphQL Admin API 2026-10 returns it for CUSTOMER_FIELDS.
const NODE = {
    id: 'gid://shopify/Customer/27606884089937',
    legacyResourceId: '27606884089937',
    displayName: 'Jane Doe',
    firstName: 'Jane',
    lastName: 'Doe',
    note: null,
    tags: ['VIP'],
    state: 'DISABLED',
    locale: 'en',
    verifiedEmail: true,
    taxExempt: false,
    taxExemptions: [],
    numberOfOrders: '0',
    createdAt: '2026-10-05T08:27:37Z',
    updatedAt: '2026-10-05T08:27:38Z',
    amountSpent: { amount: '0.0', currencyCode: 'USD' },
    defaultEmailAddress: { emailAddress: 'jane@example.com', marketingState: 'SUBSCRIBED', marketingOptInLevel: 'SINGLE_OPT_IN', marketingUpdatedAt: '2026-10-05T08:27:36Z' },
    defaultPhoneNumber: null,
    defaultAddress: { id: 'gid://shopify/MailingAddress/1?model_name=CustomerAddress', city: 'Ottawa', countryCodeV2: 'CA' },
    addresses: { nodes: [{ id: 'gid://shopify/MailingAddress/1?model_name=CustomerAddress', city: 'Ottawa', countryCodeV2: 'CA' }] },
    lastOrder: null
};

// Records every GraphQL call and answers from the supplied handler.
function mockRun(handler) {

    const calls = [];
    const run = async (query, variables) => {
        calls.push({ query, variables });
        return handler(query, variables, calls.length - 1);
    };
    return { run, calls };
}

const ok = payload => ({ ...payload, userErrors: [] });

describe('Shopify customers (GraphQL)', () => {

    describe('search and sort', () => {

        it('should AND the free query with the typed filters', () => {
            const query = gqlCustomers.buildSearchQuery({
                query: 'country:Canada',
                email: 'jane@example.com',
                tag: 'VIP',
                createdAtMin: '2026-10-01T00:00:00Z',
                updatedAtMin: '2026-10-02T00:00:00Z'
            });
            assert.strictEqual(query, '(country:Canada) AND email:"jane@example.com" AND tag:"VIP"'
                + ' AND customer_date:>="2026-10-01T00:00:00.000Z" AND updated_at:>="2026-10-02T00:00:00.000Z"');
        });

        it('should return null without filters (all customers)', () => {
            assert.strictEqual(gqlCustomers.buildSearchQuery({ query: ' ', email: '' }), null);
        });

        it('should escape quotes in filter values', () => {
            assert.strictEqual(gqlCustomers.buildSearchQuery({ tag: 'a"b' }), 'tag:"a\\"b"');
        });

        it('should build the count query from created / updated ranges only', () => {
            assert.strictEqual(
                gqlCustomers.buildCountQuery({ createdAtMin: '2026-10-01T00:00:00Z', updatedAtMax: '2026-10-03T00:00:00Z' }),
                'created_at:>="2026-10-01T00:00:00.000Z" AND updated_at:<="2026-10-03T00:00:00.000Z"'
            );
            assert.strictEqual(gqlCustomers.buildCountQuery({}), null);
        });

        it('should parse the sort input', () => {
            assert.deepStrictEqual(gqlCustomers.parseSort('UPDATED_AT_DESC'), { sortKey: 'UPDATED_AT', reverse: true });
            assert.deepStrictEqual(gqlCustomers.parseSort('NAME_ASC'), { sortKey: 'NAME', reverse: false });
            assert.deepStrictEqual(gqlCustomers.parseSort('RELEVANCE'), { sortKey: 'RELEVANCE', reverse: false });
            assert.deepStrictEqual(gqlCustomers.parseSort(), { sortKey: null, reverse: false });
        });
    });

    describe('inputs', () => {

        it('should build CustomerInput from the filled-in fields only', () => {
            const input = gqlCustomers.customerInput({
                firstName: 'Jane', lastName: '', email: ' jane@example.com ', tags: 'VIP, wholesale',
                taxExempt: false, taxExemptions: ['CA_STATUS_CARD_EXEMPTION'],
                metafields: [{ namespace: 'custom', key: 'level', value: 3 }, { key: '' }]
            });
            assert.deepStrictEqual(input, {
                firstName: 'Jane',
                email: 'jane@example.com',
                tags: ['VIP', 'wholesale'],
                taxExempt: false,
                taxExemptions: ['CA_STATUS_CARD_EXEMPTION'],
                metafields: [{ namespace: 'custom', key: 'level', type: 'single_line_text_field', value: '3' }]
            });
        });

        it('should build MailingAddressInput with upper-cased codes', () => {
            assert.deepStrictEqual(
                gqlCustomers.mailingAddressInput({ address1: '1 Main St', city: 'Ottawa', provinceCode: 'on', countryCode: 'ca', zip: '' }),
                { address1: '1 Main St', city: 'Ottawa', countryCode: 'CA', provinceCode: 'ON' }
            );
        });

        it('should not treat a name or phone alone as an address', () => {
            assert.strictEqual(gqlCustomers.mailingAddressInput({ firstName: 'Jane', phone: '+1' }), undefined);
        });

        it('should reject a country name instead of a code', () => {
            assert.throws(() => gqlCustomers.mailingAddressInput({ countryCode: 'Canada' }), err => err.statusCode === 422);
        });
    });

    describe('api', () => {

        it('should get a customer by numeric id and flatten addresses', async () => {
            const { run, calls } = mockRun(() => ({ customer: NODE }));
            const customer = await gqlCustomers(run).get('27606884089937');
            assert.strictEqual(calls[0].variables.id, 'gid://shopify/Customer/27606884089937');
            assert.ok(Array.isArray(customer.addresses));
            assert.strictEqual(customer.addresses[0].city, 'Ottawa');
        });

        it('should throw 404 for a missing customer and return null from getOrNull', async () => {
            const { run } = mockRun(() => ({ customer: null }));
            await assert.rejects(gqlCustomers(run).get('1'), err => err.statusCode === 404);
            assert.strictEqual(await gqlCustomers(run).getOrNull('1'), null);
        });

        it('should page through find up to the maximum', async () => {
            const { run, calls } = mockRun((query, variables, index) => ({
                customers: {
                    nodes: Array.from({ length: variables.first }, () => NODE),
                    pageInfo: { hasNextPage: index < 5, endCursor: `c${index}` }
                }
            }));
            const customers = await gqlCustomers(run).find({ query: 'tag:"VIP"', sortKey: 'NAME', max: 250 });
            assert.strictEqual(customers.length, 250);
            assert.deepStrictEqual(calls.map(call => call.variables.first), [100, 100, 50]);
            assert.strictEqual(calls[1].variables.after, 'c0');
            assert.strictEqual(calls[0].variables.sortKey, 'NAME');
        });

        it('should create the customer, its default address and email consent', async () => {
            const { run, calls } = mockRun(query => {
                if (query.includes('customerCreate')) return { customerCreate: ok({ customer: { id: NODE.id } }) };
                if (query.includes('customerAddressCreate')) return { customerAddressCreate: ok({ address: { id: 'a' } }) };
                return { customer: NODE };
            });
            const customer = await gqlCustomers(run).create(
                { firstName: 'Jane', email: 'jane@example.com' },
                { address: { address1: '1 Main St', countryCode: 'CA', provinceCode: 'ON' }, acceptsEmailMarketing: true }
            );
            assert.strictEqual(customer.id, NODE.id);
            assert.strictEqual(calls[0].variables.input.emailMarketingConsent.marketingState, 'SUBSCRIBED');
            assert.deepStrictEqual(calls[1].variables, {
                customerId: NODE.id,
                address: { address1: '1 Main St', countryCode: 'CA', provinceCode: 'ON' },
                setAsDefault: true
            });
        });

        it('should delete the new customer again when the address is rejected', async () => {
            const { run, calls } = mockRun(query => {
                if (query.includes('customerCreate')) return { customerCreate: ok({ customer: { id: NODE.id } }) };
                if (query.includes('customerAddressCreate')) {
                    return { customerAddressCreate: { address: null, userErrors: [{ field: ['address', 'provinceCode'], message: 'Province is invalid' }] } };
                }
                if (query.includes('customerDelete')) return { customerDelete: ok({ deletedCustomerId: NODE.id }) };
                throw new Error('unexpected ' + query);
            });
            await assert.rejects(
                gqlCustomers(run).create({ email: 'jane@example.com' }, { address: { address1: 'x', countryCode: 'US', provinceCode: 'ZZ' } }),
                err => err.statusCode === 422 && /Province is invalid/.test(err.message)
            );
            assert.ok(calls[2].query.includes('customerDelete'));
            assert.strictEqual(calls[2].variables.input.id, NODE.id);
        });

        it('should refuse a customer without name, email or phone', async () => {
            const { run, calls } = mockRun(() => ({}));
            await assert.rejects(gqlCustomers(run).create({ note: 'x' }), err => err.statusCode === 422);
            assert.strictEqual(calls.length, 0);
        });

        it('should update fields and email marketing consent separately', async () => {
            const { run, calls } = mockRun(query => query.includes('customerUpdate')
                ? { customerUpdate: ok({ customer: { id: NODE.id } }) }
                : { customerEmailMarketingConsentUpdate: ok({ customer: { id: NODE.id } }) });
            await gqlCustomers(run).update('27606884089937', { note: 'n', firstName: '' }, { emailMarketingState: 'UNSUBSCRIBED' });
            assert.deepStrictEqual(calls[0].variables.input, { note: 'n', id: NODE.id });
            assert.strictEqual(calls[1].variables.input.customerId, NODE.id);
            assert.strictEqual(calls[1].variables.input.emailMarketingConsent.marketingState, 'UNSUBSCRIBED');
        });

        it('should skip customerUpdate when only the consent changes', async () => {
            const payload = ok({ customer: { id: NODE.id } });
            const { run, calls } = mockRun(() => ({ customerEmailMarketingConsentUpdate: payload }));
            await gqlCustomers(run).update(NODE.id, {}, { emailMarketingState: 'SUBSCRIBED' });
            assert.strictEqual(calls.length, 1);
        });

        it('should turn delete userErrors into a 422', async () => {
            const { run } = mockRun(() => ({ customerDelete: { deletedCustomerId: null, userErrors: [{ field: ['id'], message: 'Customer can\'t be found' }] } }));
            await assert.rejects(gqlCustomers(run).delete('1'), err => err.statusCode === 422);
        });

        it('should count with the query', async () => {
            const { run, calls } = mockRun(() => ({ customersCount: { count: 7 } }));
            assert.strictEqual(await gqlCustomers(run).count('created_at:>="2026-10-01"'), 7);
            assert.strictEqual(calls[0].variables.query, 'created_at:>="2026-10-01"');
        });
    });

    describe('updatedAfterCreate', () => {

        it('should skip the update that belongs to the create', () => {
            assert.strictEqual(gqlCustomers.updatedAfterCreate(NODE), false);
            assert.strictEqual(gqlCustomers.updatedAfterCreate({ ...NODE, updatedAt: '2026-10-05T08:30:00Z' }), true);
        });
    });

    describe('customer picker', () => {

        it('should map Find Customers array output to select options', () => {
            const { customersToSelectArray } = require('../../customers/FindCustomers/FindCustomers');
            assert.deepStrictEqual(customersToSelectArray({
                result: [NODE, { id: 'gid://shopify/Customer/2', displayName: '', defaultEmailAddress: { emailAddress: 'x@example.com' } }]
            }), [
                { label: 'Jane Doe', value: NODE.id },
                { label: 'x@example.com', value: 'gid://shopify/Customer/2' }
            ]);
            assert.deepStrictEqual(customersToSelectArray({}), []);
        });
    });

    describe('output schemas', () => {

        const CUSTOMER = ITEM_SCHEMAS.customer;

        it('should export the customer schema as ITEM_SCHEMA of Find Customers', () => {
            const { ITEM_SCHEMA } = require('../../customers/FindCustomers/FindCustomers');
            assert.strictEqual(ITEM_SCHEMA, CUSTOMER);
        });

        it('should select every schema property in CUSTOMER_FIELDS', () => {
            for (const key of Object.keys(CUSTOMER.properties)) {
                assert.ok(new RegExp(`\\b${key}\\b`).test(gqlCustomers.CUSTOMER_FIELDS), `${key} not selected`);
            }
        });

        it('should give every leaf a title and an example', () => {
            const walk = (schema, path) => {
                for (const [key, property] of Object.entries(schema.properties)) {
                    assert.ok(property.title, `${path}${key} has no title`);
                    if (property.type === 'object') {
                        walk(property, `${path}${key}.`);
                    } else {
                        assert.ok('example' in property, `${path}${key} has no example`);
                    }
                }
            };
            walk(CUSTOMER, '');
        });

        for (const name of ['GetCustomer', 'CreateCustomer']) {
            it(`should give ${name} the customer schema`, () => {
                const port = require(`../../customers/${name}/component.json`).outPorts.find(p => p.name === 'out');
                assert.deepStrictEqual(port.schema, CUSTOMER);
            });
        }

        for (const name of ['NewCustomer', 'UpdatedCustomer']) {
            it(`should give ${name} the customer schema plus webhookTopic`, () => {
                const { schema } = require(`../../customers/${name}/component.json`).outPorts.find(p => p.name === 'out');
                const { webhookTopic, ...properties } = schema.properties;
                assert.ok(webhookTopic);
                assert.deepStrictEqual(properties, CUSTOMER.properties);
                assert.deepStrictEqual(schema.required, [...CUSTOMER.required, 'webhookTopic']);
            });
        }
    });
});

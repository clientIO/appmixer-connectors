const assert = require('assert');
const lib = require('../../lib');
const gqlDiscounts = require('../../gql-discounts');
const ITEM_SCHEMAS = require('../../item-schema-discounts.json');

class CancelError extends Error {}

// A DiscountCodeNode as discountCodeBasicCreate / codeDiscountNodeByCode return
// it on the GraphQL Admin API 2026-10 (recorded on the QA store).
const NODE = {
    id: 'gid://shopify/DiscountCodeNode/2382143062097',
    codeDiscount: {
        discountType: 'DiscountCodeBasic',
        title: 'gql4-probe discount',
        status: 'ACTIVE',
        startsAt: '2026-10-05T08:23:12Z',
        endsAt: '2026-11-04T08:23:12Z',
        usageLimit: 10,
        appliesOncePerCustomer: false,
        asyncUsageCount: 0,
        createdAt: '2026-10-05T08:23:13Z',
        updatedAt: '2026-10-05T08:23:13Z',
        combinesWith: { orderDiscounts: false, productDiscounts: false, shippingDiscounts: false },
        codes: { nodes: [{ id: 'gid://shopify/DiscountRedeemCode/34881968013393', code: 'GQL4PROBE', asyncUsageCount: 0, createdAt: '2026-10-05T08:23:13Z' }] },
        summary: '15% off one-time purchase products • Minimum purchase of $50.00',
        customerGets: { value: { percentage: 0.15 } },
        minimumRequirement: { greaterThanOrEqualToSubtotal: { amount: '50.0', currencyCode: 'USD' } }
    }
};

const DELETED = () => ({ discountCodeDelete: { deletedCodeDiscountId: NODE.id, userErrors: [] } });

function mockRun(handler) {

    const calls = [];
    const run = async (query, variables) => {
        calls.push({ query, variables });
        return handler(query, variables, calls.length - 1);
    };
    return { run, calls };
}

// Component context whose GraphQL calls go to `handler` (lib.runner is stubbed).
function mockContext(content, handler) {

    const { run, calls } = mockRun(handler);
    const context = {
        auth: { store: 'test-store', accessToken: 'shpat_test' },
        messages: { in: { content } },
        CancelError,
        calls,
        sent: [],
        async sendJson(payload, port) {
            context.sent.push({ payload, port });
        }
    };
    lib.runner = () => run;
    return context;
}

describe('Shopify discounts (GraphQL)', () => {

    const originalRunner = lib.runner;
    afterEach(() => {
        lib.runner = originalRunner;
    });

    describe('gql-discounts', () => {

        it('should lift codeDiscount to the top level and flatten codes', () => {
            const discount = gqlDiscounts.flatten(NODE);
            assert.strictEqual(discount.id, NODE.id);
            assert.strictEqual(discount.discountType, 'DiscountCodeBasic');
            assert.strictEqual(discount.title, 'gql4-probe discount');
            assert.deepStrictEqual(discount.codes, NODE.codeDiscount.codes.nodes);
            assert.strictEqual(discount.codeDiscount, undefined);
            assert.strictEqual(gqlDiscounts.flatten(null), null);
        });

        it('should build a percentage DiscountCodeBasicInput', () => {
            const input = gqlDiscounts.basicCodeInput({
                code: 'SUMMER15', valueType: 'percentage', value: 7.1, usageLimit: '10',
                minimumSubtotal: 50, endsAt: '2026-11-01T00:00:00Z', appliesOncePerCustomer: true,
                startsAt: '2026-10-01T00:00:00Z'
            });
            assert.deepStrictEqual(input, {
                title: 'SUMMER15',
                code: 'SUMMER15',
                startsAt: '2026-10-01T00:00:00Z',
                appliesOncePerCustomer: true,
                context: { all: 'ALL' },
                customerGets: { items: { all: true }, value: { percentage: 0.071 } },
                endsAt: '2026-11-01T00:00:00Z',
                usageLimit: 10,
                minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: '50' } }
            });
        });

        it('should build a fixed amount input without optional terms', () => {
            const input = gqlDiscounts.basicCodeInput({ code: 'TENOFF', title: 'Ten off', valueType: 'fixedAmount', value: 10 });
            assert.deepStrictEqual(input.customerGets.value, { discountAmount: { amount: '10', appliesOnEachItem: false } });
            assert.strictEqual(input.title, 'Ten off');
            assert.ok(input.startsAt);
            assert.strictEqual(input.endsAt, undefined);
            assert.strictEqual(input.usageLimit, undefined);
            assert.strictEqual(input.minimumRequirement, undefined);
        });

        it('should turn userErrors into a 422', async () => {
            const { run } = mockRun(() => ({
                discountCodeBasicCreate: { codeDiscountNode: null, userErrors: [{ field: ['code'], message: 'Code must be unique.' }] }
            }));
            await assert.rejects(
                gqlDiscounts(run).createBasicCode({ code: 'DUP', valueType: 'percentage', value: 10 }),
                err => err.statusCode === 422 && /must be unique/.test(err.message)
            );
        });

        it('should delete by gid built from a numeric id', async () => {
            const { run, calls } = mockRun(DELETED);
            await gqlDiscounts(run).delete('2382143062097');
            assert.deepStrictEqual(calls[0].variables, { id: NODE.id });
        });
    });

    describe('components', () => {

        it('CreateDiscountCode should generate a code when none is given and emit the discount', async () => {
            const context = mockContext({ valueType: 'percentage', value: 15 }, () => ({
                discountCodeBasicCreate: { codeDiscountNode: NODE, userErrors: [] }
            }));
            await require('../../discounts/CreateDiscountCode/CreateDiscountCode').receive(context);

            const input = context.calls[0].variables.input;
            assert.match(input.code, /^[A-HJ-NP-Z2-9]{8}$/);
            assert.strictEqual(input.title, input.code);
            assert.deepStrictEqual(input.customerGets.value, { percentage: 0.15 });
            assert.strictEqual(context.sent[0].port, 'out');
            assert.deepStrictEqual(context.sent[0].payload, gqlDiscounts.flatten(NODE));
        });

        it('CreateDiscountCode should reject a percentage over 100 and a zero value', async () => {
            const component = require('../../discounts/CreateDiscountCode/CreateDiscountCode');
            await assert.rejects(component.receive(mockContext({ valueType: 'percentage', value: 120 }, () => ({}))), CancelError);
            await assert.rejects(component.receive(mockContext({ valueType: 'fixedAmount', value: 0 }, () => ({}))), CancelError);
        });

        it('GetDiscountCode should emit the discount or cancel when the code does not exist', async () => {
            const component = require('../../discounts/GetDiscountCode/GetDiscountCode');
            const found = mockContext({ code: ' gql4probe ' }, () => ({ codeDiscountNodeByCode: NODE }));
            await component.receive(found);
            assert.deepStrictEqual(found.calls[0].variables, { code: 'gql4probe' });
            assert.strictEqual(found.sent[0].payload.codes[0].code, 'GQL4PROBE');

            const missing = mockContext({ code: 'NOPE' }, () => ({ codeDiscountNodeByCode: null }));
            await assert.rejects(component.receive(missing), CancelError);
        });

        it('DeleteDiscountCode should emit an empty object', async () => {
            const context = mockContext({ id: NODE.id }, DELETED);
            await require('../../discounts/DeleteDiscountCode/DeleteDiscountCode').receive(context);
            assert.deepStrictEqual(context.sent, [{ payload: {}, port: 'out' }]);
        });
    });

    describe('output schema', () => {

        const schema = ITEM_SCHEMAS.discountCode;

        it('should require only declared properties', () => {
            for (const key of schema.required) {
                assert.ok(schema.properties[key], key);
            }
        });

        it('should declare every field of the emitted discount', () => {
            const discount = gqlDiscounts.flatten(NODE);
            assert.deepStrictEqual(Object.keys(discount).sort(), Object.keys(schema.properties).sort());
        });

        for (const name of ['CreateDiscountCode', 'GetDiscountCode']) {
            it(`should give ${name} the discount item schema`, () => {
                const port = require(`../../discounts/${name}/component.json`).outPorts.find(p => p.name === 'out');
                assert.deepStrictEqual(port.schema, schema);
            });
        }
    });
});

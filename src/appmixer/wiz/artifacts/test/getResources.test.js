'use strict';

const assert = require('assert');
const path = require('path');
const { createMockWiz } = require('./mockWiz');
const { createWizContext } = require('./mockContext');

const resources = require(path.join(
    __dirname, '../../core/FindCloudResources/resources.exposed.js'));
const FindCloudResources = require(path.join(
    __dirname, '../../core/FindCloudResources/FindCloudResources.js'));

describe('wiz getResources pagination', () => {

    it('paginates across pages up to the requested limit', async () => {
        const { httpRequest, state } = createMockWiz({ resourcesTotal: 1234 });
        const context = createWizContext({ httpRequest });

        const records = await resources.getResources(context, { limit: 1000, filterBy: {} });

        assert.strictEqual(records.length, 1000);
        assert.strictEqual(state.resourcePages, 2, 'two 500-record pages expected');
    });

    it('caps a huge limit at 10000 and bounds the number of API calls', async () => {
        const { httpRequest, state } = createMockWiz({ resourcesTotal: Infinity });
        const context = createWizContext({ httpRequest });

        const records = await resources.getResources(context, { limit: 999999, filterBy: {} });

        assert.strictEqual(records.length, 10000);
        assert.strictEqual(state.resourcePages, 20, '10000 records / 500 per page = 20 calls');
    });

    it('keeps already-collected records when a later page comes back empty', async () => {
        // Page 1 returns 500 nodes, page 2 returns 0 nodes but claims hasNextPage.
        const { httpRequest } = createMockWiz({ pageScript: [500, 0] });
        const context = createWizContext({ httpRequest });

        const records = await resources.getResources(context, { limit: 2000, filterBy: {} });

        assert.strictEqual(records.length, 500, 'records from earlier pages must not be discarded');
    });

    it('returns an empty array (not a notFound response) when there are no results at all', async () => {
        const { httpRequest } = createMockWiz({ resourcesTotal: 0 });
        const context = createWizContext({ httpRequest });

        const records = await resources.getResources(context, { limit: 100, filterBy: {} });

        assert.deepStrictEqual(records, []);
        assert.strictEqual(context.sent.length, 0, 'getResources itself must not send anything');
    });

    ['abc', undefined, 0, -5].forEach(limit => {
        it(`falls back to the default limit for limit=${JSON.stringify(limit)}`, async () => {
            const { httpRequest, state } = createMockWiz({ resourcesTotal: Infinity });
            const context = createWizContext({ httpRequest });

            const records = await resources.getResources(context, { limit, filterBy: {} });

            assert.strictEqual(records.length, 100, 'default limit is 100');
            for (const call of state.calls) {
                assert.ok(call.data.variables.first >= 1,
                    `"first" must stay positive, got ${call.data.variables.first}`);
            }
        });
    });
});

describe('wiz FindCloudResources component', () => {

    const receive = (context) => FindCloudResources.receive(context);

    it('fans records out to the "out" port', async () => {
        const { httpRequest } = createMockWiz({ resourcesTotal: 42 });
        const context = createWizContext({ httpRequest });
        context.messages = { in: { content: { filter: '{"type":["VIRTUAL_MACHINE"]}', limit: 100 } } };

        await receive(context);

        assert.strictEqual(context.sent.length, 1);
        assert.strictEqual(context.sent[0].port, 'out');
        assert.strictEqual(context.sent[0].records.length, 42);
    });

    it('routes an empty result to the "notFound" port', async () => {
        const { httpRequest } = createMockWiz({ resourcesTotal: 0 });
        const context = createWizContext({ httpRequest });
        context.messages = { in: { content: { filter: '{"type":["VIRTUAL_MACHINE"]}', limit: 100 } } };

        await receive(context);

        assert.strictEqual(context.sent.length, 1);
        assert.strictEqual(context.sent[0].port, 'notFound');
    });

    it('stress: a 10000-record tenant with an absurd limit stays bounded', async () => {
        const { httpRequest, state } = createMockWiz({ resourcesTotal: Infinity });
        const context = createWizContext({ httpRequest });
        context.messages = { in: { content: { filter: '{}', limit: 5000000 } } };

        await receive(context);

        assert.strictEqual(context.sent[0].records.length, 10000);
        assert.ok(state.calls.length <= 20, `expected at most 20 API calls, got ${state.calls.length}`);
    });
});

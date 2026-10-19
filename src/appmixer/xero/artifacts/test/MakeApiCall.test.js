const assert = require('assert');
const testUtils = require('../../../../../test/utils.js');
const MakeApiCall = require('../../core/MakeApiCall/MakeApiCall');

const TENANT_FIRST = 'a2cc9b6e-9458-4c7d-93cc-f02b81b0594f';
const TENANT_SECOND = 'b2cc9b6e-9458-4c7d-93cc-f02b81b0594f';

describe('xero MakeApiCall', () => {

    let context;

    beforeEach(() => {
        context = testUtils.createMockContext();
        context.auth = { accessToken: 'token' };
        context.httpRequest.callsFake(async (options) => {
            if (options.url === 'https://api.xero.com/connections') {
                return { data: [{ tenantId: TENANT_FIRST }, { tenantId: TENANT_SECOND }] };
            }
            return { status: 200, headers: {}, data: {} };
        });
    });

    const run = async (content) => {
        context.messages = { in: { content: { url: '/api.xro/2.0/Organisation', method: 'GET', ...content } } };
        await MakeApiCall.receive(context);
        const calls = context.httpRequest.getCalls().map(call => call.args[0]);
        return {
            connectionsCalled: calls.some(options => options.url === 'https://api.xero.com/connections'),
            request: calls.find(options => options.url !== 'https://api.xero.com/connections')
        };
    };

    const tenantHeaders = (headers) => Object.keys(headers).filter(key => key.toLowerCase() === 'xero-tenant-id');

    it('uses the Tenant input', async () => {
        const { connectionsCalled, request } = await run({ tenantId: TENANT_SECOND });
        assert.strictEqual(request.headers['Xero-tenant-id'], TENANT_SECOND);
        assert.strictEqual(connectionsCalled, false);
    });

    it('sends headers stored by the Designer key-value field (JSON object string)', async () => {
        const { connectionsCalled, request } = await run({
            headers: JSON.stringify({ 'xero-tenant-id': TENANT_SECOND, 'If-Modified-Since': '2026-01-01' })
        });
        assert.strictEqual(request.headers['Xero-tenant-id'], TENANT_SECOND);
        assert.strictEqual(request.headers['If-Modified-Since'], '2026-01-01');
        assert.deepStrictEqual(tenantHeaders(request.headers), ['Xero-tenant-id']);
        assert.strictEqual(connectionsCalled, false);
    });

    it('the Tenant input wins over a xero-tenant-id header', async () => {
        const { request } = await run({
            tenantId: TENANT_FIRST,
            headers: JSON.stringify({ 'Xero-Tenant-Id': TENANT_SECOND })
        });
        assert.deepStrictEqual(tenantHeaders(request.headers), ['Xero-tenant-id']);
        assert.strictEqual(request.headers['Xero-tenant-id'], TENANT_FIRST);
    });

    it('falls back to the first organisation of the connection', async () => {
        const { connectionsCalled, request } = await run({});
        assert.strictEqual(connectionsCalled, true);
        assert.strictEqual(request.headers['Xero-tenant-id'], TENANT_FIRST);
    });

    it('sends query parameters stored by the Designer key-value field', async () => {
        const { request } = await run({ tenantId: TENANT_FIRST, parameters: JSON.stringify({ page: '2', where: 'Name=="A"' }) });
        assert.deepStrictEqual(request.params, { page: '2', where: 'Name=="A"' });
    });

    it('accepts a plain object and an array of {key, value} rows', async () => {
        const fromObject = await run({ tenantId: TENANT_FIRST, parameters: { page: '3' } });
        assert.deepStrictEqual(fromObject.request.params, { page: '3' });

        context.httpRequest.resetHistory();
        const fromRows = await run({ headers: [{ key: 'xero-tenant-id', value: TENANT_SECOND }] });
        assert.strictEqual(fromRows.request.headers['Xero-tenant-id'], TENANT_SECOND);
    });

    it('treats empty key-value fields as no headers or parameters', async () => {
        const { request } = await run({ tenantId: TENANT_FIRST, headers: '{}', parameters: '' });
        assert.strictEqual(request.params, undefined);
        assert.deepStrictEqual(tenantHeaders(request.headers), ['Xero-tenant-id']);
    });

    it('rejects headers that are not a JSON object', async () => {
        await assert.rejects(() => run({ headers: 'xero-tenant-id: abc' }), /Request Headers must be a JSON object/);
    });
});

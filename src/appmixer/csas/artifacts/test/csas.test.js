'use strict';

const assert = require('assert');
const { createMockContext } = require('../../../../../test/utils');

const auth = require('../../auth');
const ListAccounts = require('../../accounts/ListAccounts/ListAccounts');
const FindTransactions = require('../../accounts/FindTransactions/FindTransactions');
const MakeApiCall = require('../../accounts/MakeApiCall/MakeApiCall');

const BASE = 'https://www.csas.cz/webapi/api/v3/accounts';

function makeContext(input = {}, properties = {}) {
    const context = createMockContext();
    context.config = { apiKey: 'web-api-key' };
    context.auth = { accessToken: 'token-1' };
    context.properties = properties;
    context.messages = { in: { content: input } };
    return context;
}

// Serves `pages` (an array of item arrays) for a paginated endpoint, echoing the page.
function servePages(context, field, pages) {
    context.httpRequest.callsFake(async (req) => {
        const page = req.params.page;
        return {
            data: {
                pageNumber: page,
                pageCount: pages.length,
                pageSize: 100,
                [field]: pages[page] || []
            }
        };
    });
}

const trx = (ref, date, indicator) => ({
    entryReference: ref,
    amount: { value: 10, currency: 'CZK' },
    creditDebitIndicator: indicator,
    bookingDate: { date }
});

describe('csas', () => {

    describe('ListAccounts', () => {

        it('fetches all pages and sends them as array', async () => {
            const context = makeContext({ outputType: 'array' });
            servePages(context, 'accounts', [[{ id: 'a1' }], [{ id: 'a2' }]]);

            await ListAccounts.receive(context);

            assert.strictEqual(context.httpRequest.callCount, 2);
            const firstReq = context.httpRequest.firstCall.args[0];
            assert.strictEqual(firstReq.url, BASE + '/my/accounts');
            assert.deepStrictEqual(firstReq.params, { page: 0, size: 100 });
            assert.strictEqual(firstReq.headers['WEB-API-key'], 'web-api-key');
            assert.strictEqual(firstReq.headers.Authorization, 'Bearer token-1');
            assert.deepStrictEqual(context.sendJson.firstCall.args, [{ result: [{ id: 'a1' }, { id: 'a2' }], count: 2 }, 'out']);
        });

        it('stops when the API does not echo the requested page', async () => {
            const context = makeContext({ outputType: 'array' });
            context.httpRequest.resolves({ data: { pageNumber: 0, pageCount: 5, accounts: [{ id: 'a1' }] } });

            await ListAccounts.receive(context);

            assert.strictEqual(context.httpRequest.callCount, 2);
            assert.deepStrictEqual(context.sendJson.firstCall.args[0], { result: [{ id: 'a1' }], count: 1 });
        });

        it('returns an empty result instead of an error when used as a dropdown source', async () => {
            const context = makeContext({}, { isSource: true });
            context.httpRequest.rejects(Object.assign(new Error('boom'), { response: { status: 500, data: {} } }));

            await ListAccounts.receive(context);

            assert.deepStrictEqual(context.sendJson.firstCall.args, [{ result: [] }, 'out']);
        });

        it('maps accounts to select options', () => {
            const options = ListAccounts.toSelectOptions({
                result: [{ id: 'a1', nameI18N: 'Osobní účet', productI18N: 'Plus', identification: { other: '123/0800' } }]
            });
            assert.deepStrictEqual(options, [{ label: 'Osobní účet (Plus) – 123/0800', value: 'a1' }]);
        });

        it('fails with a clear message when the API key is not configured', async () => {
            const context = makeContext({ outputType: 'array' });
            context.config = {};
            await assert.rejects(() => ListAccounts.receive(context), /WEB-API-key/);
        });
    });

    describe('FindTransactions', () => {

        it('requires the account ID', async () => {
            const context = makeContext({ outputType: 'array' });
            await assert.rejects(() => FindTransactions.receive(context), /Account ID is required/);
        });

        it('omits empty dates and sends notFound for an empty result', async () => {
            const context = makeContext({ accountId: 'acc 1', outputType: 'array' });
            servePages(context, 'transactions', [[]]);

            await FindTransactions.receive(context);

            const req = context.httpRequest.firstCall.args[0];
            assert.strictEqual(req.url, BASE + '/my/accounts/acc%201/transactions');
            assert.deepStrictEqual(req.params, { page: 0, size: 100 });
            assert.strictEqual(context.sendJson.firstCall.args[1], 'notFound');
        });

        it('passes plain dates without a timezone shift', async () => {
            const context = makeContext({
                accountId: 'acc',
                fromDate: '2026-09-01T00:00:00+02:00',
                toDate: '2026-09-30',
                outputType: 'array'
            });
            servePages(context, 'transactions', [[trx('t1', '2026-09-02', 'DBIT')]]);

            await FindTransactions.receive(context);

            const { params } = context.httpRequest.firstCall.args[0];
            assert.strictEqual(params.fromDate, '2026-09-01');
            assert.strictEqual(params.toDate, '2026-09-30');
        });

        it('rejects an inverted date range', async () => {
            const context = makeContext({ accountId: 'acc', fromDate: '2026-10-01', toDate: '2026-09-01' });
            await assert.rejects(() => FindTransactions.receive(context), /must not be after/);
        });

        it('fetches all pages, filters by direction and sorts by booking date', async () => {
            const context = makeContext({ accountId: 'acc', creditDebitIndicator: 'CRDT', order: 'asc', outputType: 'array' });
            servePages(context, 'transactions', [
                [trx('t3', '2026-09-20', 'CRDT'), trx('t2', '2026-09-10', 'DBIT')],
                [trx('t1', '2026-09-05', 'CRDT')]
            ]);

            await FindTransactions.receive(context);

            const [out, port] = context.sendJson.firstCall.args;
            assert.strictEqual(port, 'out');
            assert.deepStrictEqual(out.result.map(t => t.entryReference), ['t1', 't3']);
            assert.strictEqual(out.count, 2);
        });

        it('emits one message per transaction for outputType object', async () => {
            const context = makeContext({ accountId: 'acc', outputType: 'object' });
            servePages(context, 'transactions', [[trx('t1', '2026-09-05', 'CRDT'), trx('t2', '2026-09-06', 'DBIT')]]);

            await FindTransactions.receive(context);

            assert.strictEqual(context.sendJson.callCount, 2);
            assert.strictEqual(context.sendJson.firstCall.args[0].entryReference, 't2');
        });

        it('generates output port options without calling the API', async () => {
            const context = makeContext({ outputType: 'array' }, { generateOutputPortOptions: true });

            await FindTransactions.receive(context);

            assert.strictEqual(context.httpRequest.callCount, 0);
            assert.strictEqual(context.sendJson.firstCall.args[0][0].value, 'result');
        });

        it('turns API errors into a CancelError', async () => {
            const context = makeContext({ accountId: 'acc', outputType: 'array' });
            context.httpRequest.rejects(Object.assign(new Error('Request failed'), {
                response: { status: 404, data: { status: 404, errors: [{ error: 'ACCOUNT_NOT_FOUND' }] } }
            }));

            await assert.rejects(() => FindTransactions.receive(context), (err) => {
                return err.name === 'CancelError' && /404/.test(err.message) && /ACCOUNT_NOT_FOUND/.test(err.message);
            });
        });
    });

    describe('MakeApiCall', () => {

        it('resolves a relative path against the Accounts API and adds credentials', async () => {
            const context = makeContext({
                url: '/my/accounts/acc/balance',
                method: 'GET',
                parameters: [{ key: 'size', value: '5' }],
                headers: [{ key: 'Authorization', value: 'Bearer evil' }]
            });
            context.httpRequest.resolves({ status: 200, headers: {}, data: { balances: [] } });

            await MakeApiCall.receive(context);

            const req = context.httpRequest.firstCall.args[0];
            assert.strictEqual(req.url, BASE + '/my/accounts/acc/balance');
            assert.deepStrictEqual(req.params, { size: '5' });
            assert.strictEqual(req.headers.Authorization, 'Bearer token-1');
            assert.deepStrictEqual(context.sendJson.firstCall.args, [{ statusCode: 200, headers: {}, body: { balances: [] } }, 'out']);
        });

        it('refuses to send credentials to another host', async () => {
            for (const url of ['https://evil.example.com/my/accounts', '//evil.example.com/x', 'https://user:pw@www.csas.cz/x']) {
                const context = makeContext({ url, method: 'GET' });
                await assert.rejects(() => MakeApiCall.receive(context), { name: 'CancelError' });
                assert.strictEqual(context.httpRequest.callCount, 0);
            }
        });

        it('drops echoed credentials from the response headers', async () => {
            const context = makeContext({ url: '/my/accounts', method: 'GET' });
            context.httpRequest.resolves({
                status: 200,
                headers: { 'content-type': 'application/json', authorization: 'Bearer token-1', 'WEB-API-key': 'web-api-key' },
                data: {}
            });

            await MakeApiCall.receive(context);

            assert.deepStrictEqual(context.sendJson.firstCall.args[0].headers, { 'content-type': 'application/json' });
        });

        it('rejects a body that is not JSON', async () => {
            const context = makeContext({ url: '/my/accounts', method: 'POST', body: '{nope' });
            await assert.rejects(() => MakeApiCall.receive(context), /valid JSON/);
        });
    });

    describe('auth', () => {

        it('builds an encoded authorization URL', () => {
            const context = makeContext();
            context.callbackUrl = 'https://api.example.com/auth/csas/callback?x=1';
            context.clientId = 'client id';
            context.ticket = 't&1';

            const url = new URL(auth.definition.authUrl(context));

            assert.strictEqual(url.origin + url.pathname, 'https://bezpecnost.csas.cz/api/psd2/fl/oidc/v1/auth');
            assert.strictEqual(url.searchParams.get('redirect_uri'), context.callbackUrl);
            assert.strictEqual(url.searchParams.get('client_id'), 'client id');
            assert.strictEqual(url.searchParams.get('state'), 't&1');
        });

        it('keeps a rotated refresh token', async () => {
            const context = makeContext();
            context.refreshToken = 'old';
            context.httpRequest.resolves({ data: { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 300 } });

            const token = await auth.definition.refreshAccessToken(context);

            assert.strictEqual(token.accessToken, 'new-access');
            assert.strictEqual(token.refreshToken, 'new-refresh');
        });

        it('names the account after the unique account owners', async () => {
            const context = makeContext();
            context.httpRequest.resolves({ data: { accounts: [{ ownersNames: ['Jan Novák'] }, { ownersNames: ['Jan Novák', 'Eva Nová'] }] } });

            const profile = await auth.definition.requestProfileInfo(context);

            assert.strictEqual(profile.displayName, 'Jan Novák, Eva Nová');
        });
    });
});

'use strict';

const assert = require('assert');
const sinon = require('sinon');

const MakeApiCall = require('../../../sharepoint/MakeApiCall/MakeApiCall');

class CancelError extends Error {}

describe('Microsoft SharePoint MakeApiCall', () => {

    let context;

    const run = (content) => {
        context.messages = { in: { content } };
        return MakeApiCall.receive(context);
    };

    beforeEach(() => {
        context = {
            auth: { accessToken: 'test-token' },
            CancelError,
            httpRequest: sinon.stub().resolves({ status: 200, data: { id: 'item-1' } }),
            sendJson: sinon.stub().resolves()
        };
    });

    describe('resolveGraphUrl', () => {

        const resolve = (url) => MakeApiCall.resolveGraphUrl(context, url);

        it('should put a path starting with a slash under /v1.0 (the documented form)', () => {

            // This used to become https://graph.microsoft.com/v1.0/https://graph.microsoft.com/drives/...
            assert.strictEqual(resolve('/drives/b!abc/items/01X'), 'https://graph.microsoft.com/v1.0/drives/b!abc/items/01X');
        });

        it('should put a path without a leading slash under /v1.0 as well', () => {

            assert.strictEqual(resolve('me/drive/root/children'), 'https://graph.microsoft.com/v1.0/me/drive/root/children');
        });

        it('should keep a path that already names the API version', () => {

            assert.strictEqual(resolve('/beta/me/drive'), 'https://graph.microsoft.com/beta/me/drive');
            assert.strictEqual(resolve('/v1.0/me/drive'), 'https://graph.microsoft.com/v1.0/me/drive');
        });

        it('should accept a full Microsoft Graph URL, e.g. an @odata.nextLink', () => {

            const nextLink = 'https://graph.microsoft.com/v1.0/drives/d1/root/delta?token=abc';
            assert.strictEqual(resolve(nextLink), nextLink);
        });

        it('should never send the token to another host', () => {

            assert.throws(() => resolve('https://attacker.example/steal'), CancelError);
            assert.throws(() => resolve('//attacker.example/steal'), CancelError);
            assert.throws(() => resolve('http://graph.microsoft.com/v1.0/me'), CancelError);
            assert.throws(() => resolve('https://user:pass@graph.microsoft.com/v1.0/me'), CancelError);
        });
    });

    describe('receive', () => {

        it('should send a JSON body through context.httpRequest', async () => {

            // onedrive-api 1.0.9 handed the parsed object to got as `body` and failed with
            // "Expected value which is `predicate returns truthy for any value`".
            await run({
                url: '/drives/d1/items/01X',
                method: 'PATCH',
                body: '{"name": "renamed.txt"}',
                parameters: [{ key: '@microsoft.graph.conflictBehavior', value: 'rename' }],
                headers: [{ key: 'Prefer', value: 'respond-async' }]
            });

            const request = context.httpRequest.firstCall.args[0];
            assert.strictEqual(request.method, 'PATCH');
            assert.strictEqual(request.url, 'https://graph.microsoft.com/v1.0/drives/d1/items/01X');
            assert.deepStrictEqual(request.data, { name: 'renamed.txt' });
            assert.deepStrictEqual(request.params, { '@microsoft.graph.conflictBehavior': 'rename' });
            assert.strictEqual(request.headers.Prefer, 'respond-async');
            assert.deepStrictEqual(context.sendJson.firstCall.args, [{ response: { id: 'item-1' } }, 'out']);
        });

        it('should not let a header row replace the account credential', async () => {

            await run({ url: '/me', method: 'GET', headers: [{ key: 'Authorization', value: 'Bearer other' }] });

            assert.strictEqual(context.httpRequest.firstCall.args[0].headers.Authorization, 'Bearer test-token');
        });

        it('should send no body and keep the empty response of a DELETE', async () => {

            context.httpRequest.resolves({ status: 204, data: '' });

            await run({ url: '/drives/d1/items/01X', method: 'DELETE' });

            assert.ok(!('data' in context.httpRequest.firstCall.args[0]));
            assert.deepStrictEqual(context.sendJson.firstCall.args, [{ response: '' }, 'out']);
        });

        it('should reject a body that is not JSON', async () => {

            await assert.rejects(() => run({ url: '/me', method: 'POST', body: '{not json' }), /valid JSON/);
            assert.strictEqual(context.httpRequest.callCount, 0);
        });

        it('should require the URL and the method', async () => {

            await assert.rejects(() => run({ method: 'GET' }), /URL is required/);
            await assert.rejects(() => run({ url: '/me' }), /Method is required/);
        });
    });
});

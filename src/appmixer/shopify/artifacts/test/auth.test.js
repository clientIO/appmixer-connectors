const assert = require('assert');
const { createHmac } = require('node:crypto');
const auth = require('../../auth');
const lib = require('../../lib');
const routes = require('../../routes');

class InvalidTokenError extends Error {}

// Auth-module context: credentials sit on the context itself. Records every
// request and answers it from the supplied handler.
function mockContext(overrides, handler) {

    const context = {
        store: 'test-store',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        InvalidTokenError,
        requests: [],
        async httpRequest(options) {
            context.requests.push(options);
            return handler(options);
        },
        ...overrides
    };

    return context;
}

function httpError(status) {

    const error = new Error(`HTTP ${status}`);
    error.response = { status, statusText: 'Error', headers: {} };
    return error;
}

describe('Shopify auth', () => {

    const { definition } = auth;

    describe('normalizeStore', () => {

        it('should accept a store handle with or without the myshopify.com suffix', () => {
            assert.strictEqual(lib.normalizeStore('Test-Store'), 'test-store');
            assert.strictEqual(lib.normalizeStore(' test-store.myshopify.com '), 'test-store');
        });

        it('should reject anything that would change the request host', () => {
            for (const store of ['', undefined, 'evil.com/', 'evil.com#', 'evil.com?x=', 'a.b', 'a@b', 'a:1', '-a', 'a b']) {
                assert.throws(() => lib.normalizeStore(store), /Invalid Shopify store address/, String(store));
            }
        });
    });

    describe('authUrl', () => {

        it('should request every scope on the store consent screen', () => {
            const url = definition.authUrl({
                clientId: 'client-id',
                callbackUrl: 'https://api.example.com/auth/shopify/callback',
                ticket: 'ticket-1',
                scope: definition.scope
            });
            assert.ok(url.startsWith('https://{{store}}.myshopify.com/admin/oauth/authorize?'));
            const params = new URLSearchParams(url.split('?')[1]);
            assert.strictEqual(params.get('client_id'), 'client-id');
            assert.strictEqual(params.get('redirect_uri'), 'https://api.example.com/auth/shopify/callback');
            assert.strictEqual(params.get('state'), 'ticket-1');
            assert.strictEqual(params.get('scope'), definition.scope.join(','));
        });

        // A component asking for a scope outside the one consent would trigger a
        // second consent, which retires the token of the first.
        it('should not let MakeApiCall ask for a scope the consent does not cover', () => {
            const component = require('../../core/MakeApiCall/component.json');
            assert.deepStrictEqual(component.auth.scope, definition.scope);
        });
    });

    describe('requestAccessToken', () => {

        it('should exchange the code for an expiring token and keep the refresh token', async () => {
            const context = mockContext({ authorizationCode: 'code-1' }, () => ({
                data: { 'access_token': 'at-1', 'expires_in': 3600, 'refresh_token': 'shprt_1', 'refresh_token_expires_in': 7776000 }
            }));
            const before = Date.now();
            const tokens = await definition.requestAccessToken(context);

            const [request] = context.requests;
            assert.strictEqual(request.method, 'POST');
            assert.strictEqual(request.url, 'https://test-store.myshopify.com/admin/oauth/access_token');
            assert.deepStrictEqual(Object.fromEntries(new URLSearchParams(request.data)), {
                'client_id': 'client-id',
                'client_secret': 'client-secret',
                code: 'code-1',
                expiring: '1'
            });

            assert.strictEqual(tokens.accessToken, 'at-1');
            assert.strictEqual(tokens.refreshToken, 'shprt_1');
            // Reported as expiring a few minutes ahead of Shopify's own hour.
            const lifetime = tokens.accessTokenExpDate.getTime() - before;
            assert.ok(lifetime > 50 * 60 * 1000 && lifetime < 60 * 60 * 1000, `lifetime ${lifetime}`);
        });

        it('should accept a non-expiring token', async () => {
            const context = mockContext({ authorizationCode: 'code-1' }, () => ({
                data: { 'access_token': 'at-1', scope: 'read_orders' }
            }));
            const tokens = await definition.requestAccessToken(context);
            assert.deepStrictEqual(tokens, { accessToken: 'at-1', refreshToken: null });
        });

        it('should not send the client secret to a host other than the store', async () => {
            const context = mockContext({ store: 'evil.com/', authorizationCode: 'code-1' }, () => ({ data: {} }));
            await assert.rejects(async () => definition.requestAccessToken(context), /Invalid Shopify store address/);
            assert.strictEqual(context.requests.length, 0);
        });
    });

    describe('refreshAccessToken', () => {

        it('should return the rotated refresh token', async () => {
            const context = mockContext({ refreshToken: 'shprt_1' }, () => ({
                data: { 'access_token': 'at-2', 'expires_in': 3600, 'refresh_token': 'shprt_2' }
            }));
            const tokens = await definition.refreshAccessToken(context);

            assert.deepStrictEqual(Object.fromEntries(new URLSearchParams(context.requests[0].data)), {
                'client_id': 'client-id',
                'client_secret': 'client-secret',
                'grant_type': 'refresh_token',
                'refresh_token': 'shprt_1'
            });
            assert.strictEqual(tokens.accessToken, 'at-2');
            assert.strictEqual(tokens.refreshToken, 'shprt_2');
            assert.ok(tokens.accessTokenExpDate instanceof Date);
        });

        it('should invalidate the account when Shopify retires the refresh token', async () => {
            const context = mockContext({ refreshToken: 'shprt_1' }, () => {
                throw httpError(401);
            });
            await assert.rejects(async () => definition.refreshAccessToken(context), InvalidTokenError);
        });

        it('should pass a transient failure through so the refresh is retried', async () => {
            const context = mockContext({ refreshToken: 'shprt_1' }, () => {
                throw httpError(503);
            });
            await assert.rejects(async () => definition.refreshAccessToken(context), err => {
                return !(err instanceof InvalidTokenError) && err.response.status === 503;
            });
        });

        it('should invalidate an account that has no refresh token', async () => {
            const context = mockContext({ refreshToken: null }, () => ({ data: {} }));
            await assert.rejects(async () => definition.refreshAccessToken(context), InvalidTokenError);
            assert.strictEqual(context.requests.length, 0);
        });
    });

    describe('validateAccessToken', () => {

        it('should query the shop through the GraphQL Admin API with the access token', async () => {
            const context = mockContext({ accessToken: 'at-1' }, () => ({
                data: { data: { shop: { id: 'gid://shopify/Shop/1', name: 'Test' }, location: { id: 'gid://shopify/Location/2' } } },
                headers: {}
            }));
            await definition.validateAccessToken(context);
            assert.strictEqual(context.requests[0].url, 'https://test-store.myshopify.com/admin/api/2026-10/graphql.json');
            assert.strictEqual(context.requests[0].method, 'POST');
            assert.strictEqual(context.requests[0].headers['X-Shopify-Access-Token'], 'at-1');
        });

        it('should report a GraphQL access error on the shop as an invalid token', async () => {
            const context = mockContext({ accessToken: 'at-1' }, () => ({
                data: { errors: [{ message: 'Access denied', extensions: { code: 'ACCESS_DENIED' } }] },
                headers: {}
            }));
            await assert.rejects(async () => definition.validateAccessToken(context), InvalidTokenError);
        });

        it('should report a rejected token as invalid', async () => {
            const context = mockContext({ accessToken: 'at-1' }, () => {
                throw httpError(401);
            });
            await assert.rejects(async () => definition.validateAccessToken(context), InvalidTokenError);
        });
    });
});

describe('Shopify compliance webhooks', () => {

    const secret = 'client-secret';
    const body = Buffer.from('{"shop_id":954889,"shop_domain":"test-store.myshopify.com"}');
    const signature = createHmac('sha256', secret).update(body).digest('base64');

    it('should accept a body signed with the client secret', () => {
        assert.strictEqual(routes.verifyWebhookHmac(body, signature, secret), true);
    });

    it('should reject a tampered body, a wrong or missing signature and a missing secret', () => {
        assert.strictEqual(routes.verifyWebhookHmac(Buffer.from('{"shop_id":1}'), signature, secret), false);
        assert.strictEqual(routes.verifyWebhookHmac(body, 'AAAA', secret), false);
        assert.strictEqual(routes.verifyWebhookHmac(body, undefined, secret), false);
        assert.strictEqual(routes.verifyWebhookHmac(body, signature, undefined), false);
    });

    describe('routes', () => {

        // Minimal plugin context: collects the registered routes and the saved requests.
        function mockPluginContext(config) {

            const saved = [];
            class Model {
                populate(data) {
                    this.data = data;
                    return this;
                }
                async save() {
                    saved.push(this.data);
                }
                static async find() {
                    return saved;
                }
                static createSettersAndGetters() {}
            }

            const registered = [];
            const context = {
                config,
                db: { Model },
                http: { router: { register: route => registered.push(route) } }
            };
            routes(context);

            const find = (method, path) => registered.find(route => route.method === method && route.path === path);
            return { saved, find };
        }

        const h = {
            response: payload => ({ code: statusCode => ({ payload, statusCode }) }),
            redirect: location => ({ location })
        };

        it('should store a signed compliance request and answer an unsigned one with 401', async () => {
            const { saved, find } = mockPluginContext({ clientSecret: secret });
            const route = find('POST', '/customers/redact');
            assert.strictEqual(route.options.auth, false);
            assert.strictEqual(route.options.payload.parse, false);

            const rejected = await route.options.handler({ payload: body, headers: { 'x-shopify-hmac-sha256': 'AAAA' } }, h);
            assert.strictEqual(rejected.statusCode, 401);
            assert.strictEqual(JSON.stringify(rejected.payload).includes(signature), false);
            assert.strictEqual(saved.length, 0);

            const accepted = await route.options.handler({ payload: body, headers: { 'x-shopify-hmac-sha256': signature } }, h);
            assert.deepStrictEqual(accepted, {});
            assert.strictEqual(saved.length, 1);
            assert.strictEqual(saved[0].request['shop_domain'], 'test-store.myshopify.com');
        });

        it('should list the stored requests to tenant admins only', async () => {
            const { find } = mockPluginContext({ clientSecret: secret });
            const post = find('POST', '/shop/redact');
            await post.options.handler({ payload: body, headers: { 'x-shopify-hmac-sha256': signature } }, h);

            const list = find('GET', '/shop/redact');
            // No `auth: false` — the engine authenticates the request first.
            assert.strictEqual(list.options.auth, undefined);

            const requests = [
                { auth: { credentials: { scope: ['user'] } } },
                { auth: { credentials: {} } },
                { auth: {} },
                {}
            ];
            for (const req of requests) {
                const denied = await list.options.handler(req, h);
                assert.strictEqual(denied.statusCode, 403, JSON.stringify(req));
            }

            const listed = await list.options.handler({ auth: { credentials: { scope: ['user', 'admin'] } } }, h);
            assert.strictEqual(listed.length, 1);
        });

        it('should register all three compliance topics', () => {
            const { find } = mockPluginContext({ clientSecret: secret });
            for (const path of ['/customers/data_request', '/customers/redact', '/shop/redact']) {
                assert.ok(find('POST', path), path);
                assert.ok(find('GET', path), path);
            }
        });

        it('should redirect an install request to the consent screen of the shop only', () => {
            const { find } = mockPluginContext({
                clientId: 'client-id',
                clientSecret: secret,
                appStoreInstallRedirectUri: 'https://tenant.example.com/shopify'
            });
            const { handler } = find('GET', '/install').options;

            const { location } = handler({ query: { shop: 'test-store.myshopify.com' } }, h);
            const url = new URL(location);
            assert.strictEqual(url.origin + url.pathname, 'https://test-store.myshopify.com/admin/oauth/authorize');
            assert.strictEqual(url.searchParams.get('client_id'), 'client-id');
            assert.strictEqual(url.searchParams.get('redirect_uri'), 'https://tenant.example.com/shopify');

            for (const shop of [undefined, 'evil.com', 'evil.com/x.myshopify.com', 'test-store.myshopify.com.evil.com']) {
                assert.strictEqual(handler({ query: { shop } }, h).statusCode, 400, String(shop));
            }
        });
    });
});

const assert = require('assert');
const endpoints = require('../../endpoints');
const crmAuth = require('../../auth');
const booksAuth = require('../../books/auth');
const ZohoClient = require('../../ZohoClient');
const CrmMakeApiCall = require('../../crm/MakeApiCall/MakeApiCall');
const BooksMakeApiCall = require('../../books/MakeApiCall/MakeApiCall');

// httpRequest mock: records token requests (post) and the baseURL of every API client (create),
// answering API requests from `apiResponse`.
function mockHttpRequest(tokenResponse, apiResponse) {

    const calls = { posts: [], baseURLs: [], requests: [] };
    const httpRequest = async options => {
        calls.requests.push(options);
        return { data: {} };
    };
    httpRequest.post = async url => {
        calls.posts.push(url);
        return { data: tokenResponse };
    };
    httpRequest.create = ({ baseURL }) => {
        calls.baseURLs.push(baseURL);
        return async () => ({ data: apiResponse });
    };
    return { httpRequest, calls };
}

// Zoho across all data centers: only `accountsServer` knows the authorization code and only
// `apiDomain` accepts the access token. Other data centers answer like Zoho does - HTTP 200 with
// `invalid_code` from the token endpoint, HTTP 401 from the API.
function mockZoho({ accountsServer, apiDomain, tokenResponse, apiResponse }) {

    const calls = { posts: [], gets: [] };
    const httpRequest = async options => {
        calls.gets.push(options.url);
        if (!options.url.startsWith(apiDomain + '/')) {
            const err = new Error('Request failed with status code 401');
            err.response = { status: 401, data: { code: 'INVALID_TOKEN' } };
            throw err;
        }
        return { data: apiResponse };
    };
    httpRequest.post = async url => {
        calls.posts.push(url);
        return { data: url.startsWith(accountsServer + '/') ? tokenResponse : { error: 'invalid_code' } };
    };
    httpRequest.create = () => async () => ({ data: apiResponse });
    return { httpRequest, calls };
}

const host = url => new URL(url).origin;

const CANADA_TOKEN = {
    'access_token': 'access-token',
    'refresh_token': 'refresh-token',
    'api_domain': 'https://www.zohoapis.ca',
    'token_type': 'Bearer',
    'expires_in': 3600
};

describe('Zoho data centers', () => {

    describe('endpoints', () => {

        it('should resolve each data center to its own accounts server and API host', () => {

            const expected = {
                us: ['https://accounts.zoho.com', 'https://www.zohoapis.com'],
                eu: ['https://accounts.zoho.eu', 'https://www.zohoapis.eu'],
                in: ['https://accounts.zoho.in', 'https://www.zohoapis.in'],
                au: ['https://accounts.zoho.com.au', 'https://www.zohoapis.com.au'],
                cn: ['https://accounts.zoho.com.cn', 'https://www.zohoapis.com.cn'],
                jp: ['https://accounts.zoho.jp', 'https://www.zohoapis.jp'],
                ca: ['https://accounts.zohocloud.ca', 'https://www.zohoapis.ca'],
                sa: ['https://accounts.zoho.sa', 'https://www.zohoapis.sa'],
                uk: ['https://accounts.zoho.uk', 'https://www.zohoapis.uk'],
                ae: ['https://accounts.zoho.ae', 'https://www.zohoapis.ae'],
                sg: ['https://accounts.zoho.sg', 'https://www.zohoapis.sg']
            };
            for (const [region, [accounts, api]] of Object.entries(expected)) {
                assert.strictEqual(endpoints.resolveAccountsServer({ region }), accounts, region);
                assert.strictEqual(endpoints.resolveApiDomain({ region: region.toUpperCase() }), api, region);
            }
        });

        it('should fail on an unknown region instead of falling back to the US data center', () => {

            assert.throws(() => endpoints.resolveApiDomain({ region: 'xx' }), /Unsupported Zoho data center: xx/);
            assert.throws(() => endpoints.resolveAccountsServer({ region: 'xx' }), /Unsupported Zoho data center/);
            assert.throws(() => endpoints.resolveApiDomain({}), /Missing region/);
        });

        it('should prefer the servers Zoho named over the region', () => {

            assert.strictEqual(
                endpoints.resolveAccountsServer({ accountsServer: 'https://accounts.zohocloud.ca/', region: 'us' }),
                'https://accounts.zohocloud.ca'
            );
            assert.strictEqual(
                endpoints.resolveApiDomain({ apiDomain: 'https://www.zohoapis.ca', region: 'us' }),
                'https://www.zohoapis.ca'
            );
        });

        it('should never trust a server that is not a known Zoho host', () => {

            for (const url of [
                'https://evil.example.com',
                'https://accounts.zoho.com.evil.example',
                'http://accounts.zoho.com',
                'https://accounts.zoho.com@evil.example',
                'https://www.zohoapis.com',
                undefined,
                ''
            ]) {
                assert.strictEqual(endpoints.trustedAccountsServer(url), null, String(url));
            }
            assert.strictEqual(endpoints.trustedApiDomain('https://www.zohoapis.ca.evil.example'), null);
            assert.strictEqual(endpoints.trustedApiDomain('https://accounts.zohocloud.ca'), null);
            assert.strictEqual(
                endpoints.resolveAccountsServer({ accountsServer: 'https://evil.example.com', region: 'ca' }),
                'https://accounts.zohocloud.ca'
            );
        });
    });

    describe('OAuth flow of a Canada account', () => {

        for (const [name, auth, apiResponse] of [
            ['CRM', crmAuth, { users: [{ id: '1', email: 'user@example.com' }] }],
            ['Books', booksAuth, { organizations: [{ 'organization_id': '1', 'is_default_org': true }] }]
        ]) {

            it(`${name}: should exchange the code and call the API in the Canada data center`, async () => {

                const { httpRequest, calls } = mockZoho({
                    accountsServer: 'https://accounts.zohocloud.ca',
                    apiDomain: 'https://www.zohoapis.ca',
                    tokenResponse: CANADA_TOKEN,
                    apiResponse
                });
                const context = {
                    clientId: 'client-id',
                    clientSecret: 'client-secret',
                    authorizationCode: 'code',
                    callbackUrl: 'https://example.com/auth/zoho/callback',
                    httpRequest
                };

                await auth.definition.processRedirectionCallback({
                    code: 'code',
                    location: 'ca',
                    'accounts-server': 'https://accounts.zohocloud.ca'
                });
                const token = await auth.definition.requestAccessToken(context);
                assert.strictEqual(token.accessToken, 'access-token');
                assert.ok(calls.posts[0].startsWith('https://accounts.zohocloud.ca/oauth/v2/token?'), calls.posts[0]);

                const profileInfo = await auth.definition.requestProfileInfo({ ...context, accessToken: 'access-token' });
                assert.deepStrictEqual(calls.gets.map(host), ['https://www.zohoapis.ca']);
                assert.strictEqual(profileInfo.region, 'ca');
                assert.strictEqual(profileInfo.accountsServer, 'https://accounts.zohocloud.ca');
                assert.strictEqual(profileInfo.apiDomain, 'https://www.zohoapis.ca');

                await auth.definition.refreshAccessToken({ ...context, refreshToken: 'refresh-token', profileInfo });
                assert.ok(calls.posts[1].startsWith('https://accounts.zohocloud.ca/oauth/v2/token?'), calls.posts[1]);
            });
        }

        it('should fall back to the region when the callback has no accounts-server', async () => {

            const { httpRequest, calls } = mockHttpRequest(CANADA_TOKEN, {});
            await crmAuth.definition.processRedirectionCallback({ code: 'code', location: 'ca' });
            await crmAuth.definition.requestAccessToken({ clientId: 'c', clientSecret: 's', httpRequest });
            assert.ok(calls.posts[0].startsWith('https://accounts.zohocloud.ca/'), calls.posts[0]);
        });
    });

    describe('OAuth flow through the Auth Hub', () => {

        // In the Auth Hub the redirect callback, the code exchange and the profile request may run
        // in different processes. A process that did not see the callback has no hint at all.
        const forgetCallback = auth => auth.definition.processRedirectionCallback({ code: 'code' });

        const EU_TOKEN = { ...CANADA_TOKEN, 'api_domain': 'https://www.zohoapis.eu' };

        for (const [name, auth, apiResponse, apiPath] of [
            ['CRM', crmAuth, { users: [{ id: '1', email: 'user@example.com' }] }, '/crm/v2/users?type=CurrentUser'],
            ['Books', booksAuth, { organizations: [{ 'organization_id': '1', 'is_default_org': true }] }, '/books/v3/organizations']
        ]) {

            it(`${name}: should find the data center of an EU account without the redirect callback`, async () => {

                const { httpRequest, calls } = mockZoho({
                    accountsServer: 'https://accounts.zoho.eu',
                    apiDomain: 'https://www.zohoapis.eu',
                    tokenResponse: EU_TOKEN,
                    apiResponse
                });
                const context = { clientId: 'c', clientSecret: 's', authorizationCode: 'code', httpRequest };

                await forgetCallback(auth);
                const token = await auth.definition.requestAccessToken(context);
                assert.strictEqual(token.accessToken, 'access-token');
                assert.deepStrictEqual(calls.posts.map(host), ['https://accounts.zoho.com', 'https://accounts.zoho.eu']);

                await forgetCallback(auth);
                const profileInfo = await auth.definition.requestProfileInfo({ ...context, accessToken: 'access-token' });
                assert.deepStrictEqual(calls.gets, ['https://www.zohoapis.com' + apiPath, 'https://www.zohoapis.eu' + apiPath]);
                assert.strictEqual(profileInfo.region, 'eu');
                assert.strictEqual(profileInfo.accountsServer, 'https://accounts.zoho.eu');
                assert.strictEqual(profileInfo.apiDomain, 'https://www.zohoapis.eu');
            });
        }

        it('should not trust a hint left by another account being connected', async () => {

            const { httpRequest, calls } = mockZoho({
                accountsServer: 'https://accounts.zoho.eu',
                apiDomain: 'https://www.zohoapis.eu',
                tokenResponse: EU_TOKEN,
                apiResponse: { users: [{ id: '1' }] }
            });
            const context = { clientId: 'c', clientSecret: 's', authorizationCode: 'code', httpRequest };

            await crmAuth.definition.processRedirectionCallback({
                code: 'other', location: 'ca', 'accounts-server': 'https://accounts.zohocloud.ca'
            });
            await crmAuth.definition.requestAccessToken(context);
            assert.deepStrictEqual(calls.posts.map(host).slice(0, 3), [
                'https://accounts.zohocloud.ca', 'https://accounts.zoho.com', 'https://accounts.zoho.eu'
            ]);

            const profileInfo = await crmAuth.definition.requestProfileInfo({ ...context, accessToken: 'access-token' });
            assert.strictEqual(profileInfo.region, 'eu');
            // the code exchange found EU, the profile request in the same process goes there directly
            assert.deepStrictEqual(calls.gets.map(host), ['https://www.zohoapis.eu']);
        });

        it('should name every data center when none issues a token', async () => {

            const { httpRequest } = mockZoho({ accountsServer: 'https://nowhere.example', apiDomain: 'https://nowhere.example' });
            await forgetCallback(crmAuth);
            await assert.rejects(
                crmAuth.definition.requestAccessToken({ clientId: 'c', clientSecret: 's', httpRequest }),
                /No Zoho data center agreed to issue an access token \(us: invalid_code, .*, cn: invalid_code\)/
            );
        });

        it('should stop on a refusal that is not about the data center', async () => {

            const { httpRequest, calls } = mockZoho({
                accountsServer: 'https://accounts.zoho.com',
                apiDomain: 'https://www.zohoapis.com',
                tokenResponse: { error: 'invalid_redirect_uri' }
            });
            await forgetCallback(crmAuth);
            await assert.rejects(
                crmAuth.definition.requestAccessToken({ clientId: 'c', clientSecret: 's', httpRequest }),
                /Zoho refused to issue an access token: invalid_redirect_uri/
            );
            assert.strictEqual(calls.posts.length, 1);
        });

        it('Books: should skip a data center where Books does not run', async () => {

            const urls = [];
            const httpRequest = async ({ url }) => {
                urls.push(url);
                if (url.startsWith('https://www.zohoapis.sg/')) {
                    return { data: { organizations: [{ 'organization_id': '1', 'is_default_org': true }] } };
                }
                const err = new Error('Request failed');
                // Books in the Singapore data center redirects to a 404 page; here the US one does
                err.response = { status: url.startsWith('https://www.zohoapis.com/') ? 404 : 401 };
                throw err;
            };
            await forgetCallback(booksAuth);
            const profileInfo = await booksAuth.definition.requestProfileInfo({ accessToken: 't', httpRequest });
            assert.strictEqual(profileInfo.region, 'sg');
            // every data center before Singapore was asked; China, tried last, was not
            assert.strictEqual(urls.length, 10);
            assert.ok(!urls.some(url => url.includes('.com.cn')));
        });

        it('should refresh a token without profileInfo, as the Auth Hub does', async () => {

            for (const auth of [crmAuth, booksAuth]) {
                const { httpRequest, calls } = mockZoho({
                    accountsServer: 'https://accounts.zoho.eu',
                    apiDomain: 'https://www.zohoapis.eu',
                    tokenResponse: EU_TOKEN
                });
                const token = await auth.definition.refreshAccessToken({
                    clientId: 'c', clientSecret: 's', refreshToken: 'r', profileInfo: null, httpRequest
                });
                assert.strictEqual(token.accessToken, 'access-token');
                assert.deepStrictEqual(calls.posts.map(host), ['https://accounts.zoho.com', 'https://accounts.zoho.eu']);
                assert.ok(calls.posts[1].includes('grant_type=refresh_token&refresh_token=r'), calls.posts[1]);
            }
        });

        it('should ask only the data center of the account when profileInfo names it', async () => {

            const { httpRequest, calls } = mockZoho({
                accountsServer: 'https://accounts.zoho.com',
                apiDomain: 'https://www.zohoapis.com',
                tokenResponse: EU_TOKEN
            });
            await assert.rejects(
                crmAuth.definition.refreshAccessToken({
                    clientId: 'c', clientSecret: 's', refreshToken: 'r', profileInfo: { region: 'eu' }, httpRequest
                }),
                /Zoho refused to refresh the access token: invalid_code/
            );
            assert.deepStrictEqual(calls.posts.map(host), ['https://accounts.zoho.eu']);
        });

        it('should not try other data centers when the API fails for another reason', async () => {

            const httpRequest = async () => {
                const err = new Error('Request failed with status code 500');
                err.response = { status: 500 };
                throw err;
            };
            await forgetCallback(crmAuth);
            await assert.rejects(
                crmAuth.definition.requestProfileInfo({ accessToken: 't', httpRequest }),
                /status code 500/
            );
        });
    });

    describe('existing accounts with only a stored region', () => {

        it('should keep using the region for the API and token refresh', async () => {

            const { httpRequest, calls } = mockHttpRequest(CANADA_TOKEN, {});
            const profileInfo = { region: 'eu' };

            new ZohoClient({ auth: { accessToken: 'token' }, profileInfo, httpRequest });
            assert.strictEqual(calls.baseURLs[0], 'https://www.zohoapis.eu');

            await crmAuth.definition.refreshAccessToken({
                clientId: 'c', clientSecret: 's', refreshToken: 'r', profileInfo, httpRequest
            });
            assert.ok(calls.posts[0].startsWith('https://accounts.zoho.eu/'), calls.posts[0]);
        });
    });

    describe('older copies of auth.js and of the components', () => {

        // The shared files (endpoints.js, ZohoClient.js) are loaded next to older copies of auth.js
        // and of the components, which still use the previous interface.
        it('should keep accountsEndpoint and apiEndpoint exported', () => {

            assert.strictEqual(endpoints.accountsEndpoint('eu'), 'https://accounts.zoho.eu');
            assert.strictEqual(endpoints.apiEndpoint('EU'), 'https://www.zohoapis.eu');
        });

        it('should accept the region as a string in ZohoClient', () => {

            const { httpRequest, calls } = mockHttpRequest(CANADA_TOKEN, {});
            new ZohoClient({ accessToken: 'token', httpRequest }, 'eu');
            assert.strictEqual(calls.baseURLs[0], 'https://www.zohoapis.eu');
        });
    });

    describe('MakeApiCall', () => {

        function makeApiCallContext(profileInfo, httpRequest) {

            return {
                auth: { accessToken: 'token' },
                profileInfo,
                httpRequest,
                messages: { in: { content: { url: '/test', method: 'GET' } } },
                sendJson: async () => {},
                CancelError: Error
            };
        }

        it('CRM: should call the API host of the account data center', async () => {

            const { httpRequest, calls } = mockHttpRequest(CANADA_TOKEN, {});
            await CrmMakeApiCall.receive(makeApiCallContext({ region: 'ca', apiDomain: 'https://www.zohoapis.ca' }, httpRequest));
            await CrmMakeApiCall.receive(makeApiCallContext({ region: 'jp' }, httpRequest));
            await CrmMakeApiCall.receive(makeApiCallContext(undefined, httpRequest));
            assert.deepStrictEqual(calls.requests.map(r => r.url), [
                'https://www.zohoapis.ca/test',
                'https://www.zohoapis.jp/test',
                'https://www.zohoapis.com/test'
            ]);
        });

        it('Books: should call the API host of the account data center', async () => {

            const { httpRequest, calls } = mockHttpRequest(CANADA_TOKEN, {});
            await BooksMakeApiCall.receive(makeApiCallContext({ region: 'ca' }, httpRequest));
            assert.strictEqual(calls.requests[0].url, 'https://www.zohoapis.ca/books/v3/test');
        });
    });
});

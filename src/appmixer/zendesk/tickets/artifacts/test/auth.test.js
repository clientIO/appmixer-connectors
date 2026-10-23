const assert = require('assert');
const auth = require('../../auth');
const lib = require('../../lib');

// Auth-module context: credentials sit on the context itself. Records every request.
function mockContext(overrides) {

    const context = {
        subdomain: 'example',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        authorizationCode: 'code',
        callbackUrl: 'https://api.example.com/auth/appmixer:zendesk:tickets/callback',
        accessToken: 'access-token',
        config: {},
        requests: [],
        async httpRequest(options) {
            context.requests.push(options);
            return { data: { access_token: 'token', user: { email: 'user@example.com' } } };
        },
        ...overrides
    };

    return context;
}

describe('Zendesk auth', () => {

    const { definition } = auth;

    describe('zendeskOrigin', () => {

        it('should build the origin from a plain subdomain', () => {
            assert.strictEqual(lib.zendeskOrigin('example'), 'https://example.zendesk.com');
            assert.strictEqual(lib.zendeskOrigin('my-company-2'), 'https://my-company-2.zendesk.com');
        });

        it('should reject anything that could change the request host or path', () => {
            [
                'evil.example/x?',
                'evil.example#',
                'user@evil.example',
                'example.zendesk.com',
                'https://example.zendesk.com',
                ' example',
                '-example',
                '',
                null,
                undefined
            ].forEach(value => {
                assert.throws(() => lib.zendeskOrigin(value), /Invalid Zendesk subdomain/, String(value));
            });
        });
    });

    describe('requests carrying credentials', () => {

        it('should send the token request only to the Zendesk host', async () => {

            const context = mockContext({});
            await definition.requestAccessToken(context);
            assert.strictEqual(context.requests[0].url, 'https://example.zendesk.com/oauth/tokens');
        });

        it('should not send the client secret anywhere for an invalid subdomain', async () => {

            const context = mockContext({ subdomain: 'evil.example/x?' });
            await assert.rejects(() => definition.requestAccessToken(context), /Invalid Zendesk subdomain/);
            assert.strictEqual(context.requests.length, 0);
        });

        it('should not send the access token anywhere for an invalid subdomain', async () => {

            const profileContext = mockContext({ subdomain: 'evil.example/x?' });
            await assert.rejects(() => definition.requestProfileInfo(profileContext), /Invalid Zendesk subdomain/);
            assert.strictEqual(profileContext.requests.length, 0);

            const validateContext = mockContext({ subdomain: 'evil.example/x?' });
            await assert.rejects(() => definition.validate(validateContext), /Invalid Zendesk subdomain/);
            assert.strictEqual(validateContext.requests.length, 0);
        });
    });
});

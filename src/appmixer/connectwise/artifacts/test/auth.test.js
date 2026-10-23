'use strict';

const assert = require('assert');
const auth = require('../../auth');

// Auth-module context: the account fields sit on the context itself. Records every request.
function mockContext(overrides) {

    const context = {
        environment: 'eu',
        clientId: 'client-id',
        companyId: 'company',
        publicKey: 'public',
        privateKey: 'private',
        requests: [],
        httpRequest: async (options) => {
            context.requests.push(options);
            return { status: 200, data: { contact: { email: 'user@example.com' } } };
        },
        ...overrides
    };
    context.httpRequest.get = async (url, options) => context.httpRequest({ method: 'GET', url, ...options });
    return context;
}

describe('ConnectWise auth', () => {

    const { definition } = auth;

    it('should send the credentials only to the ConnectWise host', async () => {

        const context = mockContext({});
        await definition.validate(context);
        assert.strictEqual(context.requests[0].url, 'https://api-eu.myconnectwise.net/v4_6_release/apis/3.0/system/info');
    });

    it('should not send the credentials anywhere for an invalid environment', async () => {

        for (const value of ['evil.example/x?', 'eu.evil.example#', 'us', '', undefined]) {
            const context = mockContext({ environment: value });
            await assert.rejects(() => definition.validate(context), /Invalid ConnectWise/, String(value));
            assert.strictEqual(context.requests.length, 0, String(value));
        }
    });
});

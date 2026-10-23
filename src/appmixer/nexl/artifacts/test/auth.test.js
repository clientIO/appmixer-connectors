'use strict';

const assert = require('assert');
const auth = require('../../auth');

// Auth-module context: the account fields sit on the context itself. Records every request.
function mockContext(overrides) {

    const context = {
        regionPrefix: 'nexl-360-latest',
        apiKey: 'api-key',
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

describe('Nexl auth', () => {

    const { definition } = auth;

    it('should send the credentials only to the Nexl host', async () => {

        const context = mockContext({});
        await definition.validate(context);
        assert.strictEqual(context.requests[0].url, 'https://nexl-360-latest.nexl.cloud/api/graphql');
    });

    it('should not send the credentials anywhere for an invalid regionPrefix', async () => {

        for (const value of ['evil.example/x?', 'evil.example#', 'user@evil.example', '-example', '', undefined]) {
            const context = mockContext({ regionPrefix: value });
            await assert.rejects(() => definition.validate(context), /Invalid Nexl/, String(value));
            assert.strictEqual(context.requests.length, 0, String(value));
        }
    });
});

'use strict';

const assert = require('assert');
const auth = require('../../auth');
const lib = require('../../lib');

// Auth-module context: the account fields sit on the context itself. Records every request.
function mockContext(overrides) {

    const context = {
        domain: 'acme-123.myfreshworks.com/crm/sales',
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

describe('Freshsales auth', () => {

    const { definition } = auth;

    it('should send the credentials only to the Freshsales host', async () => {

        const context = mockContext({});
        await definition.validate(context);
        assert.strictEqual(context.requests[0].url, 'https://acme-123.myfreshworks.com/crm/sales/api/selector/owners');
    });

    it('should not send the credentials anywhere for an invalid domain', async () => {

        for (const value of [
            'evil.example/x',
            'evil.example/acme.myfreshworks.com',
            'acme.myfreshworks.com.evil.example',
            'user@acme.myfreshworks.com',
            'acme.myfreshworks.com?x',
            'https://acme.myfreshworks.com',
            '',
            undefined
        ]) {
            const context = mockContext({ domain: value });
            await assert.rejects(() => definition.validate(context), /Invalid Freshsales/, String(value));
            assert.strictEqual(context.requests.length, 0, String(value));
        }
    });

    it('should accept a legacy freshsales.io alias and a trailing slash', () => {

        assert.strictEqual(lib.freshsalesBaseUrl('acme.freshsales.io'), 'https://acme.freshsales.io');
        assert.strictEqual(lib.freshsalesBaseUrl('acme.myfreshworks.com/crm/sales/'),
            'https://acme.myfreshworks.com/crm/sales');
    });
});

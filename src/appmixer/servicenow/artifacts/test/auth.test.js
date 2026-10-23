'use strict';

const assert = require('assert');
const auth = require('../../auth');
const lib = require('../../lib');

// Auth-module context: the account fields sit on the context itself. Records every request.
function mockContext(overrides) {

    const context = {
        instance: 'dev144860',
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

describe('ServiceNow auth', () => {

    const { definition } = auth;

    it('should send the credentials only to the ServiceNow host', async () => {

        const context = mockContext({});
        await definition.validate(context);
        assert.strictEqual(context.requests[0].url, 'https://dev144860.service-now.com/api/now/table/problem?sysparm_limit=1');
    });

    it('should not send the credentials anywhere for an invalid instance', async () => {

        for (const value of ['evil.example/x?', 'evil.example#', 'user@evil.example', '-example', '', undefined]) {
            const context = mockContext({ instance: value });
            await assert.rejects(() => definition.validate(context), /Invalid ServiceNow/, String(value));
            assert.strictEqual(context.requests.length, 0, String(value));
        }
    });

    it('should build component URLs only for a plain instance name', () => {

        assert.strictEqual(lib.instanceOrigin('dev-144860'), 'https://dev-144860.service-now.com');
        assert.throws(() => lib.instanceOrigin('dev144860.service-now.com'), /Invalid ServiceNow/);
    });
});

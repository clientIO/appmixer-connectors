'use strict';

// Every MakeApiCall sends the Request Headers and Query Parameters set in the Designer.
//
// The Designer's key-value field stores its rows as the JSON string of an object
// ('{"X-Kv-Test":"header-value"}', appmixer-fe inspector-field-input-key-value.vue).
// Until 2026-10 most MakeApiCall components accepted only an array of {key, value}
// rows and silently dropped that string — Freshdesk #9751 (Xero) found it.

const assert = require('assert');
const path = require('path');
const glob = require('glob');
const { createMockContext } = require('./utils');

const ROOT = path.join(__dirname, '..');
const components = glob.sync('src/**/MakeApiCall/MakeApiCall.js', { cwd: ROOT }).sort();

// Inputs a few components require on top of url/method; harmless for the rest.
const EXTRA_INPUTS = { baseUrl: 'https://kv-test.example.com', tenantId: 'kv-test-tenant', companyId: 'kv-test' };

// Account data a few components read before the call (DocuSign base URI, Jira cloud id).
const PROFILE_INFO = {
    accounts: [{ base_uri: 'https://kv-test.example.com', account_id: 'kv-test', is_default: true }],
    apiUrl: 'https://api.atlassian.com/ex/jira/kv-test',
    region: 'us'
};

// Any auth or config field reads as a placeholder: a URL for *Url/*Uri/*Domain fields, a token otherwise.
const auth = new Proxy({}, {
    get: (target, prop) => {
        if (typeof prop !== 'string') return undefined;
        return /(url|uri|domain)$/i.test(prop) ? 'https://kv-test.example.com' : 'kv-test';
    }
});

const findHeader = (headers, name) => Object.entries(headers || {})
    .find(([key]) => key.toLowerCase() === name.toLowerCase());

describe('MakeApiCall: Request Headers and Query Parameters from the Designer', function() {

    this.timeout(10000);

    it('finds the MakeApiCall components', () => {
        assert(components.length > 150, `only ${components.length} found`);
    });

    components.forEach(file => {

        it(path.dirname(file).replace(/^src\//, ''), async () => {

            const component = require(path.join(ROOT, file));
            const context = createMockContext();
            context.auth = auth;
            context.config = auth;
            context.profileInfo = { ...context.profileInfo, ...PROFILE_INFO };
            context.httpRequest.resolves({
                status: 200,
                statusCode: 200,
                headers: { 'content-type': 'application/json' },
                data: {}
            });
            context.messages = {
                in: {
                    content: {
                        ...EXTRA_INPUTS,
                        url: '/kv-test',
                        method: 'GET',
                        headers: JSON.stringify({ 'X-Kv-Test': 'header-value' }),
                        parameters: JSON.stringify({ kvtest: 'param-value' })
                    }
                }
            };

            await component.receive(context);

            const requests = context.httpRequest.getCalls().map(call => call.args[0]);
            const request = requests.find(options => findHeader(options.headers, 'X-Kv-Test'));
            assert(request, `no request carried the X-Kv-Test header (${requests.length} request(s))`);
            assert.strictEqual(findHeader(request.headers, 'X-Kv-Test')[1], 'header-value');

            const params = request.params || {};
            const inUrl = /[?&]kvtest=param-value(&|$)/.test(request.url || '');
            assert(params.kvtest === 'param-value' || inUrl, 'the kvtest query parameter was not sent');
        });
    });
});

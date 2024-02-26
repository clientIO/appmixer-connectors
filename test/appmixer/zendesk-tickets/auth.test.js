const assert = require('assert');
const sinon = require('sinon');
const auth = require('../../../src/appmixer/zendesktickets/auth');

describe('auth.js', function() {

    let context;

    beforeEach(function() {
        context = {
            clientId: 'testClientId',
            clientSecret: 'testClientSecret',
            authorizationCode: 'testAuthorizationCode',
            callbackUrl: 'testCallbackUrl',
            ticket: 'testTicket',
            scope: ['offline_access'],
            resource: 'testResource',
            httpRequest: sinon.stub(),
            accessToken: 'testAccessToken',
            profileInfo: {
                fullname: 'testFullname',
                internalemailaddress: 'testEmail',
                systemuserid: 'testUserId'
            }
        };
    });

    describe('replaceVariables', function() {

        it('should not fail with refreshToken null', async function() {

            const refreshToken = null;

            // Simulate engine/src/auth/OAuth2.js
            const getRefreshToken = () => {

                if (refreshToken === null) {
                    throw new Error('Refresh token not set.');
                }
                return 'foo';
            };
            Object.defineProperty(context, 'refreshToken', { get: () => getRefreshToken() });

            const str = auth.definition.replaceVariables(context, 'https://d3v-appmixer.zendesk.com/oauth/tokens');
            assert.strictEqual(str, 'https://d3v-appmixer.zendesk.com/oauth/tokens');
	    });
    });

    describe('requestAccessToken', function() {

        it('should be a function', async function() {
            assert.strictEqual(typeof auth.definition.requestAccessToken, 'function');
        });

        it('should use subdomain from config', async function() {

            context.config = {
                subdomain: 'foo'
            };

            context.httpRequest.resolves({
                data: { access_token: 'testAccessToken' }
            });

            await auth.definition.requestAccessToken(context);
            // Called with correct subdomain
            assert.strictEqual(context.httpRequest.args[0][0].url, 'https://foo.zendesk.com/oauth/tokens');
        });
    });

    describe('refreshAccessToken', function() {

        it('should be null', async function() {
            assert.strictEqual(auth.definition.refreshAccessToken, null);
        });
    });
});

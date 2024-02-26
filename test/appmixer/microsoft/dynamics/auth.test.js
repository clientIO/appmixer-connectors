const assert = require('assert');
const sinon = require('sinon');
const dynamicsAuth = require('../../../../src/appmixer/microsoft/dynamics/auth');

describe('dynamicsAuth', function() {
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

    describe('authUrl', function() {
        it('should return correct authUrl', function() {
            const authUrl = dynamicsAuth.definition.authUrl(context);
            assert.strictEqual(authUrl, 'https://login.microsoftonline.com/common/oauth2/authorize?resource={{resource}}&client_id=testClientId&response_type=code&redirect_uri=testCallbackUrl&response_mode=query&state=testTicket&scope=offline_access');
        });
    });

    describe('requestAccessToken', function() {
        it('should request access token correctly', async function() {
            context.httpRequest.resolves({
                data: {
                    access_token: 'testAccessToken',
                    refresh_token: 'testRefreshToken',
                    resource: 'testResource',
                    expires_in: 3600
                }
            });

            const result = await dynamicsAuth.definition.requestAccessToken(context);
            assert.deepStrictEqual(result, {
                accessToken: 'testAccessToken',
                refreshToken: 'testRefreshToken',
                resource: 'testResource',
                accessTokenExpDate: new Date(Date.now() + 3600000)
            });
        });
    });

    describe('accountNameFromProfileInfo', function() {
        it('should return correct account name', function() {
            const accountName = dynamicsAuth.definition.accountNameFromProfileInfo(context);
            assert.strictEqual(accountName, 'testResource - testFullname');
        });
    });

    describe('requestProfileInfo', function() {
        it('should request profile info correctly', async function() {
            context.httpRequest.onFirstCall().resolves({ data: { UserId: 'testUserId' } });
            context.httpRequest.onSecondCall()
                .resolves({ data: { fullname: 'testFullname', internalemailaddress: 'testEmail' } });

            const result = await dynamicsAuth.definition.requestProfileInfo(context);
            assert.deepStrictEqual(result, { fullname: 'testFullname', internalemailaddress: 'testEmail' });
        });
    });

    describe('validateAccessToken', function() {
        it('should validate access token correctly', async function() {
            context.httpRequest.resolves({ data: {} });

            await dynamicsAuth.definition.validateAccessToken(context);
            assert.strictEqual(context.httpRequest.calledOnce, true);
        });
    });

    describe('pre', function() {
        it('should have pre for a resource url', function() {
            assert.strictEqual(dynamicsAuth.definition.pre.resource.type, 'text');
            assert.strictEqual(dynamicsAuth.definition.pre.resource.name, 'Resource');
            assert.strictEqual(dynamicsAuth.definition.pre.resource.required, true);
        });
    });
});

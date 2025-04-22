const sinon = require('sinon');

module.exports = {

    createMockContext: function(options) {

        const context = {
            clientId: 'testClientId',
            clientSecret: 'testClientSecret',
            authorizationCode: 'testAuthorizationCode',
            callbackUrl: 'testCallbackUrl',
            ticket: 'testTicket',
            scope: ['offline_access'],
            resource: 'https://org422b05be.crm4.dynamics.com',
            httpRequest: sinon.stub(),
            accessToken: 'testAccessToken',
            profileInfo: {
                fullname: 'testFullname',
                internalemailaddress: 'testEmail',
                systemuserid: 'testUserId'
            },
            lock: sinon.stub(),
            log: console.log,
            CancelError: Error,
            sendJson: sinon.stub(),
            staticCache: {
                get: sinon.stub(),
                set: sinon.stub()
            },
            componentStaticCall: sinon.stub()
        };

        if (options) {
            Object.assign(context, options);
        }

        return context;
    }
};

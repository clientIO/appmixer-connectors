const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../../utils.js');
const NewEmail = require('../../../src/appmixer/microsoft/mail/NewEmail/NewEmail.js');
const UpdatedEmail = require('../../../src/appmixer/microsoft/mail/UpdatedEmail/UpdatedEmail.js');
const DeletedEmail = require('../../../src/appmixer/microsoft/mail/DeletedEmail/DeletedEmail.js');

describe('Triggers', function() {

    let context = testUtils.createMockContext();

    beforeEach(function() {

        sinon.reset();
        context = testUtils.createMockContext();
        context.getWebhookUrl.returns('https://test.com');
        context.properties = {};
    });

    // Test the NewEmail, UpdatedEmail, and DeletedEmail triggers the same way.
    for (const [name, trigger] of Object.entries({ NewEmail, UpdatedEmail, DeletedEmail })) {

        describe(name, function() {

            describe('receive', function() {

                describe('timeout', function() {

                    it('should renew before expiration - 1st run', async function() {

                        // Stub the HTTP request to return the subscription data.
                        context.httpRequest.onFirstCall().resolves({ data: {} });

                        // This creates a subscription for Microsoft Email API.
                        await trigger.start(context);

                        assert.equal(context.httpRequest.callCount, 1, 'should call http request');
                        assert.equal(context.setTimeout.callCount, 1, 'should set timeout');

                        const expirationDateTimeMicrosoft = new Date(
                            context.httpRequest.args[0][0].data.expirationDateTime
                        );
                        const expirationDateTimeAppmixer = new Date(Date.now() + context.setTimeout.args[0][1]);
                        // Add 5 seconds to the expiration date time of Appmixer to simulate the time it takes to renew the subscription.
                        const totalTimeWithApiCall = new Date(expirationDateTimeAppmixer.getTime() + 5000);
                        // Expiration date set in the Microsoft API should be always greater than
                        // the expiration date set in the Appmixer API plus the time it takes to renew the subscription.
                        // console.log([expirationDateTimeMicrosoft, expirationDateTimeAppmixer, totalTimeWithApiCall]);

                        assert.ok(
                            expirationDateTimeMicrosoft > totalTimeWithApiCall,
                            'should renew before expiration: ' + expirationDateTimeMicrosoft + ' > ' + totalTimeWithApiCall
                        );
                    });

                    it('should renew before expiration - 2nd run', async function() {

                        // Stub the HTTP request to return the subscription data.
                        context.httpRequest.onFirstCall().resolves({ data: {} });

                        // Assuming the subscription is already created.
                        context.messages = { timeout: true };
                        context.state = { subscriptionId: 'testSubscriptionId' };
                        await trigger.receive(context);

                        assert.equal(context.httpRequest.callCount, 1, 'should call http request');
                        assert.equal(context.setTimeout.callCount, 1, 'should set timeout');

                        const expirationDateTimeMicrosoft = new Date(
                            context.httpRequest.args[0][0].data.expirationDateTime
                        );
                        const expirationDateTimeAppmixer = new Date(Date.now() + context.setTimeout.args[0][1]);
                        // Add 5 seconds to the expiration date time of Appmixer to simulate the time it takes to renew the subscription.
                        const totalTimeWithApiCall = new Date(expirationDateTimeAppmixer.getTime() + 5000);
                        // Expiration date set in the Microsoft API should be always greater than
                        // the expiration date set in the Appmixer API plus the time it takes to renew the subscription.
                        // console.log([expirationDateTimeMicrosoft, expirationDateTimeAppmixer, totalTimeWithApiCall]);

                        assert.ok(
                            expirationDateTimeMicrosoft > totalTimeWithApiCall,
                            'should renew before expiration: ' + expirationDateTimeMicrosoft + ' > ' + totalTimeWithApiCall
                        );
                    });
                });
            });
        });
    }
});

const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../test-utils');
const action = require('../../../../../src/appmixer/microsoft/dynamics/ListLookupOptions/ListLookupOptions.js');

describe('ListLookupOptions', function() {

    const context = testUtils.createMockContext();

    beforeEach(function() {

        sinon.reset();
    });

    describe('Account', function() {

        const fixtureAccountData = require('./fixture-account-data.json');
        const fixtureAccountMetadata = require('./fixture-account-metadata.json');

        describe('receive', function() {

            beforeEach(function() {

                // Set properties to generate inspector.
                context.messages = {
                    in: {
                        content: {
                            targets: ['account'],
                            isSource: true
                        }
                    }
                };

                // Stub the HTTP request to return the metadata for Account entity.
                context.httpRequest.onFirstCall().resolves({
                    data: fixtureAccountMetadata
                });
                // Stub the second HTTP request to return data for Account entity.
                context.httpRequest.onSecondCall().resolves({
                    data: {
                        value: fixtureAccountData.value
                    }
                });
            });

            it('should call metadata api for account', async function() {

                await action.receive(context);
                const out = context.httpRequest.firstCall.args[0];
                const expectedUrlPath = 'EntityDefinitions(LogicalName=\'account\')?'
                    + '$select=LogicalCollectionName,PrimaryNameAttribute,PrimaryIdAttribute';
                assert.ok(out.url.endsWith(expectedUrlPath), 'should call metadata api for account');
            });

            it('should call data api for account', async function() {

                await action.receive(context);
                const out = context.httpRequest.secondCall.args[0];
                assert.match(out.url, /accounts\?\$select=accountid,name/, 'should call data api for account');
            });

            it('should cache the results for 1 min', async function() {

                // Stub the third HTTP request to return the metadata for Account entity.
                context.httpRequest.onCall(2).resolves({
                    data: fixtureAccountMetadata
                });
                // Stub the fourth HTTP request to return data for Account entity.
                context.httpRequest.onCall(3).resolves({
                    data: {
                        value: fixtureAccountData.value
                    }
                });
                // First call to staticCache.get should return null. All other calls should return the cached value.
                context.staticCache.get.onFirstCall().resolves(null)
                    .onSecondCall().resolves(42)
                    .onThirdCall().resolves(42);

                await action.receive(context);
                assert.equal(context.lock.callCount, 1);
                assert.equal(context.staticCache.get.callCount, 1);
                assert.equal(context.staticCache.set.callCount, 1);

                await action.receive(context); // 2nd call should use cache.
                await action.receive(context); // 3rd call should use cache.

                // Jump 1 minute into the future.
                const now = new Date();
                now.setMinutes(now.getMinutes() + 1);
                sinon.useFakeTimers(now);

                await action.receive(context); // 4th call should not use cache.
                assert.equal(context.httpRequest.callCount, 4);
                assert.equal(context.lock.callCount, 4);
                assert.equal(context.staticCache.get.callCount, 4);
                assert.equal(context.staticCache.set.callCount, 2);
                assert.equal(context.httpRequest.callCount, 4);
            });
        });
    });
});

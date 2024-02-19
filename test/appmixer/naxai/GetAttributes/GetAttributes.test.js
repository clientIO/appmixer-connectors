const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../../utils.js');
const action = require('../../../../src/appmixer/naxai/people/GetAttributes/GetAttributes.js');

describe('GetAttributes', function() {

    const context = testUtils.createMockContext();

    beforeEach(function() {

        sinon.reset();
    });

    describe('Attributes', function() {

        const fixtureAttributeData = [
            { name: 'newKey' },
            { name: 'newKey-2' }
        ];

        describe('receive', function() {

            beforeEach(function() {

                // Set properties to generate inspector.
                context.messages = {
                    in: {
                        content: {
                            isSource: true
                        }
                    }
                };

                // Stub the HTTP request to return the metadata for Account entity.
                context.httpRequest.onFirstCall().resolves({
                    data: fixtureAttributeData
                });
                // Stub the second HTTP request to return data for Account entity.
                context.httpRequest.onSecondCall().resolves({
                    data: [...fixtureAttributeData, { name: 'newKey-3' }]
                });
            });

            it('should cache the results for 20 sec', async function() {

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
                assert.equal(context.httpRequest.callCount, 2);
                assert.equal(context.lock.callCount, 4);
                assert.equal(context.staticCache.get.callCount, 4);
                assert.equal(context.staticCache.set.callCount, 2);
            });
        });
    });
});

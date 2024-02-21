const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../../utils.js');
const action = require('../../../../src/appmixer/naxai/people/PutContact/PutContact.js');

describe('PutContact', function() {

    const context = testUtils.createMockContext();

    beforeEach(function() {

        sinon.reset();
    });

    describe('generate inspector', function() {

        describe('receive', function() {

            beforeEach(function() {

                // Set properties to generate inspector.
                context.properties = { generateInspector: true };

                // Stub the call to GetAttributes.
                context.componentStaticCall.resolves({ items: [{ name: 'newKey1' }, { name: 'newKey2' }] });
            });

            it('should have additional fields', async function() {

                const expectedKeys = [
                    'identifier',
                    'email',
                    'phone',
                    'externalId',
                    'unsubscribed',
                    'language',
                    'createdAt',
                    'newKey1',
                    'newKey2'
                ];

                await action.receive(context);
                // context.sendJson is called with additional fields.
                // check the stub
                assert.ok(context.sendJson.calledOnce, 'context.sendJson should be called once');

                const callToGetAttributes = context.componentStaticCall.getCall(0);
                assert.equal(callToGetAttributes.args[0], 'appmixer.naxai.people.GetAttributes', 'componentStaticCall should be called with "appmixer.naxai.people.GetAttributes"');

                const inPort = context.sendJson.getCall(0).args[0];
                const keys = inPort.schema.properties;
                assert.deepEqual(Object.keys(keys), expectedKeys, 'context.sendJson should be called with expected keys');
            });
        });
    });
});

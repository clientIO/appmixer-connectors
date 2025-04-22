const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../test-utils');
const commons = require('../../../../src/appmixer/microsoft/dynamics/dynamics-commons');
const action = require('../../../../src/appmixer/microsoft/dynamics/DynamicEntity/DynamicEntity.js');

describe.skip('DynamicEntity', function() {

    const context = testUtils.createMockContext();

    beforeEach(function() {

        sinon.reset();
    });

    describe('Lead', function() {

        describe('receive - getOutputPortOptions', function() {

            beforeEach(function() {

                // Set properties to generate output port options.
                context.properties = { generateOutputPortOptions: true };
            });

            describe('outputType = object', function() {

                it('should call dynamics-commons.getOutputPortOptions', async function() {

                    // Mock `getOutputPortOptions` to return an empty object.
                    commons.getOutputPortOptions = sinon.stub().resolves({});
                    // Call the action and inspect its output.
                    await action.receive(context);
                    assert.equal(commons.getOutputPortOptions.callCount, 1);
                });
            });
        });
    });
});

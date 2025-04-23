const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../test-utils.js');

describe('Update components', function() {

    const context = testUtils.createMockContext();

    beforeEach(function() {

        sinon.reset();
    });

    describe('Lead', function() {

        beforeEach(function() {

            // Set properties to generate output port options.
            context.messages = { in: { content: { firstname: 'foo' } } };
            context.properties = {};
        });

        it('UpdateLead should call UpdateObjectRecord', async function() {

            const action = require('../../../../src/appmixer/microsoft/dynamics/UpdateLead/UpdateLead.js');
            // Specify the entityName and data.
            context.messages.in.objectName = 'lead';

            const stubLead = {
                objectName: 'lead',
                data: {
                    firstname: 'foo'
                },
                id: 'testId',
                link: 'testLink',
                status: 'testStatus',
                statusText: 'testStatusText'
            };

            context.componentStaticCall.returns(stubLead);
            // Call the action and inspect its output.
            await action.receive(context);

            // Check that the UpdateObjectRecord component was called with the expected parameters.
            const [component, outportName, contextParams] = context.componentStaticCall.firstCall.args;
            assert.equal(component, 'appmixer.microsoft.dynamics.UpdateObjectRecord');
            assert.equal(outportName, 'out');
            assert.equal(contextParams.messages.in.objectName, 'lead');
            assert.equal(contextParams.messages.in.firstname, 'foo');
        });
    });
});

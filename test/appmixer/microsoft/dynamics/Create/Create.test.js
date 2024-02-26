const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../test-utils');

describe('Create components', function() {

    const context = testUtils.createMockContext();

    beforeEach(function() {

        sinon.reset();
    });

    describe('Create', function() {

        beforeEach(function() {

            // Set properties to generate output port options.
            context.messages = { in: { content: { firstname: 'foo' } } };
            context.properties = {};
        });

        it('CreateLead should call CreateObjectRecord', async function() {

            const action = require('../../../../../src/appmixer/microsoft/dynamics/CreateLead/CreateLead.js');
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

            const [component, outportName, contextParams] = context.componentStaticCall.firstCall.args;
            assert.equal(component, 'appmixer.microsoft.dynamics.CreateObjectRecord');
            assert.equal(outportName, 'out');
            assert.equal(contextParams.messages.in.objectName, 'lead');
            assert.equal(contextParams.messages.in.firstname, 'foo');
        });
    });
});

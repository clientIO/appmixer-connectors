const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../test-utils');

describe('Get components', function() {

    let context = testUtils.createMockContext();

    beforeEach(function() {

        sinon.reset();
        context = testUtils.createMockContext();
        // Set properties to generate output port options.
        context.messages = { in: { content: { id: 'testId' } } };
        context.properties = {};
        context.componentStaticCall.onFirstCall().resolves({ response: 42 });
    });

    it('GetAccount should call MakeApiCall', async function() {

        const action = require('../../../../src/appmixer/microsoft/dynamics/GetAccount/GetAccount.js');
        // Call the action and inspect its output.
        await action.receive(context);

        // First API call should be to get the metadata for the Lead entity.
        const component = context.componentStaticCall.firstCall.args[0];
        assert.equal(component, 'appmixer.microsoft.dynamics.MakeApiCall');
    });

    it('GetContact should call MakeApiCall', async function() {

        const action = require('../../../../src/appmixer/microsoft/dynamics/GetContact/GetContact.js');
        // Call the action and inspect its output.
        await action.receive(context);

        // First API call should be to get the metadata for the Lead entity.
        const component = context.componentStaticCall.firstCall.args[0];
        assert.equal(component, 'appmixer.microsoft.dynamics.MakeApiCall');
    });

    it('GetLead should call MakeApiCall', async function() {

        const action = require('../../../../src/appmixer/microsoft/dynamics/GetLead/GetLead.js');
        // Call the action and inspect its output.
        await action.receive(context);

        // First API call should be to get the metadata for the Lead entity.
        const component = context.componentStaticCall.firstCall.args[0];
        assert.equal(component, 'appmixer.microsoft.dynamics.MakeApiCall');
    });
});

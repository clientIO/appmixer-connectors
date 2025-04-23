const assert = require('assert');
const testUtils = require('../test-utils');

describe('Delete components', function() {

    let context = testUtils.createMockContext();

    beforeEach(function() {

        context = testUtils.createMockContext();
        // Set properties to generate output port options.
        context.messages = { in: { content: { id: 'testId' } } };
        context.properties = {};
    });

    it('DeleteAccount should call MakeApiCall', async function() {

        const action = require('../../../../src/appmixer/microsoft/dynamics/DeleteAccount/DeleteAccount.js');
        // Call the action and inspect its output.
        await action.receive(context);

        const [component, outportName, contextParams] = context.componentStaticCall.firstCall.args;
        assert.equal(component, 'appmixer.microsoft.dynamics.MakeApiCall');
        assert.equal(outportName, 'out');
        assert.equal(contextParams.messages.in.url, '/api/data/v9.2/accounts(testId)');
        assert.equal(contextParams.messages.in.method, 'DELETE');
    });

    it('DeleteContact should call MakeApiCall', async function() {

        const action = require('../../../../src/appmixer/microsoft/dynamics/DeleteContact/DeleteContact.js');
        // Call the action and inspect its output.
        await action.receive(context);

        const [component, outportName, contextParams] = context.componentStaticCall.firstCall.args;
        assert.equal(component, 'appmixer.microsoft.dynamics.MakeApiCall');
        assert.equal(outportName, 'out');
        assert.equal(contextParams.messages.in.url, '/api/data/v9.2/contacts(testId)');
        assert.equal(contextParams.messages.in.method, 'DELETE');
    });

    it('DeleteLead should call MakeApiCall', async function() {

        const action = require('../../../../src/appmixer/microsoft/dynamics/DeleteLead/DeleteLead.js');
        // Call the action and inspect its output.
        await action.receive(context);

        const [component, outportName, contextParams] = context.componentStaticCall.firstCall.args;
        assert.equal(component, 'appmixer.microsoft.dynamics.MakeApiCall');
        assert.equal(outportName, 'out');
        assert.equal(contextParams.messages.in.url, '/api/data/v9.2/leads(testId)');
        assert.equal(contextParams.messages.in.method, 'DELETE');
    });
});

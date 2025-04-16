const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../utils.js');
let HubSpot = require('../../src/appmixer/hubspot/Hubspot.js');

describe('UpdateContact', () => {

    const UpdateContact = require('../../src/appmixer/hubspot/crm/UpdateContact/UpdateContact.js');
    let context = testUtils.createMockContext();
    let hubspotStub;

    beforeEach(async () => {

        // Reset the context.
        context = testUtils.createMockContext();
        context.messages = { in: { content: {} } };
        // Reset hubspot stub if it was called before
        if (hubspotStub) {
            hubspotStub.restore();
        }
        // Stub the hubspot methods
        hubspotStub = sinon.stub(HubSpot.prototype, 'call');
    });

    it('should update contact with custom properties', async function() {

        const updateData = {
            email: 'john.doe@example.com',
            firstname: 'John',
            lastname: 'Doe'
        };
        // This is how the inspector sends custom properties
        updateData.additionalProperties = {
            AND: [
                { name: 'some_custom_property', value: 'foo' },
                { name: 'another_custom_property', value: 43 }
            ]
        };
        context.messages.in.content = updateData;

        /** Expected data to/from HubSpot */
        const expectedData = {
            email: updateData.email,
            firstname: updateData.firstname,
            lastname: updateData.lastname,
            some_custom_property: 'foo',
            another_custom_property: 43
        };

        // Mock the response of Contact update
        hubspotStub.resolves({
            data: {
                id: '38533722672',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-02-04T00:00:00Z',
                ...expectedData
            }
        });

        await UpdateContact.receive(context);

        assert.equal(hubspotStub.callCount, 1, 'Should make 1 call to update contact');
        // Assert that custom properties were sent to HubSpot
        const updateContactArgs = hubspotStub.getCall(0).args;
        assert.equal(updateContactArgs[0], 'patch', 'Should call patch method');
        assert.equal(updateContactArgs[1], 'crm/v3/objects/contacts/' + encodeURIComponent(context.messages.in.content.email), 'Should call correct endpoint');
        assert.deepEqual(updateContactArgs[2].properties, expectedData, 'Should send custom properties to HubSpot');
    });
});

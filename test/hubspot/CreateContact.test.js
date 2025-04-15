const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../utils.js');
let HubSpot = require('../../src/appmixer/hubspot/Hubspot.js');

describe('CreateContact', () => {

    const CreateContact = require('../../src/appmixer/hubspot/crm/CreateContact/CreateContact.js');
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

    it('should create contact with custom properties', async function() {

        const createData = {
            email: 'john.doe@example.com',
            firstname: 'John',
            lastname: 'Doe',
            phone: '123456789',
            website: 'www.example.com',
            company: 'Example',
            address: 'Example street',
            city: 'Example city',
            state: 'Example state',
            zip: '12345'
        };
        // This is how the inspector sends custom properties
        createData.additionalProperties = {
            AND: [
                { name: 'some_custom_property', value: 'foo' },
                { name: 'another_custom_property', value: 43 }
            ]
        };
        context.messages.in.content = createData;

        /** Expected data to/from HubSpot */
        const expectedData = {
            properties: {
	            ...createData,
	            some_custom_property: 'foo',
	            another_custom_property: 43
            }
        };
        delete expectedData.properties.additionalProperties;

        // Mock the response of Contact creation
        hubspotStub.resolves({
            data: {
                id: '38533722672',
                properties: {
                    createdAt: '2023-01-01T00:00:00Z',
                    updatedAt: '2023-02-04T00:00:00Z',
                    ...expectedData.properties
                }
            }
        });

        await CreateContact.receive(context);

        assert.equal(hubspotStub.callCount, 1, 'Should make 1 call to create contact');
        // Assert that custom properties were sent to HubSpot
        const createContactArgs = hubspotStub.getCall(0).args;
        assert.equal(createContactArgs[0], 'post', 'Should call post method');
        assert.equal(createContactArgs[1], 'crm/v3/objects/contacts', 'Should call correct endpoint');
        assert.deepEqual(createContactArgs[2], expectedData, 'Should send custom properties to HubSpot');

        // Assert `context.sendJson` was called with the correct data
        const sendJsonArgs = context.sendJson.getCall(0).args[0];
        console.log('sendJsonArgs', sendJsonArgs);
        assert.equal(sendJsonArgs.id, '38533722672', 'Should return contact ID');
        assert.equal(sendJsonArgs.some_custom_property, 'foo', 'Should return custom property');
        assert.equal(sendJsonArgs.another_custom_property, 43, 'Should return custom property');
    });
});

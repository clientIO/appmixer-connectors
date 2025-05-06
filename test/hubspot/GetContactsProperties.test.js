const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../utils.js');
let HubSpot = require('../../src/appmixer/hubspot/Hubspot.js');

describe('GetContactsProperties', () => {

    let context = testUtils.createMockContext();
    let hubspotStub;

    beforeEach(async () => {

        // Reset the context.
        context = testUtils.createMockContext();
        // Reset hubspot stub if it was called before
        if (hubspotStub) {
            hubspotStub.restore();
        }
        // Stub the hubspot methods
        hubspotStub = sinon.stub(HubSpot.prototype, 'call');

        context.messages = { in: { content: {} } };
    });

    it('should cache outPort schema', async function() {

        // The require is inside the test because we need to stub the call method
        const GetContactsProperties = require('../../src/appmixer/hubspot/crm/GetContactsProperties/GetContactsProperties.js');

        // Mock the response of the hubspot call for deal properties
        const mockedResponse = {
            data: {
                results: [
                    {
                        name: 'firstname',
                        label: 'First Name',
                        type: 'string',
                        fieldType: 'text',
                        groupName: 'contactinformation',
                        options: []
                    },
                    {
                        name: 'email',
                        label: 'Email',
                        type: 'string',
                        fieldType: 'text',
                        groupName: 'contactinformation',
                        options: []
                    }
                ]
            }
        };
        hubspotStub.withArgs('get', 'crm/v3/properties/contacts').resolves(mockedResponse);

        // 2 calls to get contact properties
        context.properties = {};
        await GetContactsProperties.receive(context);
        await GetContactsProperties.receive(context);

        assert.equal(hubspotStub.callCount, 1, 'Should make only 1 call to get contact properties');
        // Check the outPort schema
        const sendJsonArgs = context.sendJson.getCall(0).args;
        assert.deepEqual(sendJsonArgs[0], mockedResponse.data.results, 'Should cache the outPort schema');
    });

    describe('custom fields', () => {

        it('should return custom and HubSpot fields', async function() {

            // The require is inside the test because we need to stub the call method
            const GetContactsProperties = require('../../src/appmixer/hubspot/crm/GetContactsProperties/GetContactsProperties.js');

            // Mock the response of the hubspot call for contact properties
            const mockedResponse = [
                {
                    name: 'jirka_notes',
                    label: 'Jirka Notes',
                    type: 'string',
                    fieldType: 'text',
                    description: 'What does Jirka think of this contact?',
                    createdUserId: '71561347',
                    displayOrder: -1,
                    hidden: false,
                    formField: true
                },
                {
                    name: 'jirka_some_hidden_stuff',
                    label: 'jirka some hidden stuff',
                    type: 'string',
                    fieldType: 'text',
                    description: 'This is not visible in the HubSpot UI',
                    createdUserId: '71561347',
                    displayOrder: -1,
                    hidden: false,
                    formField: false
                },
                {
                    name: 'job_function',
                    label: 'Job function',
                    type: 'string',
                    fieldType: 'text',
                    description: "Contact's job function. Required for the Facebook Ads Integration. Automatically synced from the Lead Ads tool.",
                    displayOrder: -1,
                    hidden: false,
                    formField: true
                },
                {
                    name: 'jobtitle',
                    label: 'Job Title',
                    type: 'string',
                    fieldType: 'text',
                    description: "A contact's job title",
                    displayOrder: 12,
                    hidden: false,
                    formField: true
                }
            ];
            hubspotStub.withArgs('get', 'crm/v3/properties/contacts').resolves({ data: mockedResponse });

            // eslint-disable-next-line max-len
            const additionalFieldsSelectArray = await GetContactsProperties.additionalFieldsToSelectArray(mockedResponse);

            assert.equal(additionalFieldsSelectArray.length, 4, 'Should return custom and HubSpot fields');
            assert.equal(additionalFieldsSelectArray[0].label, 'Jirka Notes', 'Should return only custom fields');
        });
    });
});

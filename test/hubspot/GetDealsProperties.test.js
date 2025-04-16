const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../utils.js');
let HubSpot = require('../../src/appmixer/hubspot/Hubspot.js');

describe('GetDealsProperties', () => {

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
    });

    it('should cache outPort schema', async function() {

        const GetDealsProperties = require('../../src/appmixer/hubspot/crm/GetDealsProperties/GetDealsProperties.js');

        // Mock the response of the hubspot call for deal properties
        const mockedResponse = {
            data: {
                results: [
                    {
                        name: 'dealname',
                        label: 'Deal Name',
                        type: 'string',
                        fieldType: 'text',
                        groupName: 'dealinformation',
                        options: []
                    },
                    {
                        name: 'amount',
                        label: 'Amount',
                        type: 'number',
                        fieldType: 'number',
                        groupName: 'dealinformation',
                        options: []
                    }
                ]
            }
        };
        hubspotStub.withArgs('get', 'crm/v3/properties/deals').resolves(mockedResponse);

        // 2 calls to get deal properties
        context.properties = {};
        await GetDealsProperties.receive(context);
        await GetDealsProperties.receive(context);

        assert.equal(hubspotStub.callCount, 1, 'Should make only 1 call to get deal properties');
        // Check the outPort schema
        const sendJsonArgs = context.sendJson.getCall(0).args;
        assert.deepEqual(sendJsonArgs[0], mockedResponse.data.results, 'Should cache the outPort schema');
    });

    describe('custom fields', () => {

        it('should return only custom fields', async function() {

            const GetDealsProperties = require('../../src/appmixer/hubspot/crm/GetDealsProperties/GetDealsProperties.js');

            // Mock the response of the hubspot call for deal properties
            const mockedResponse = [
                {
                    name: 'jirka_notes',
                    label: 'Jirka Notes',
                    type: 'string',
                    fieldType: 'text',
                    description: 'What does Jirka think of this deal?',
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
                    description: 'This should not be in inspector',
                    createdUserId: '71561347',
                    displayOrder: -1,
                    hidden: false,
                    formField: false
                },
                {
                    name: 'dealname',
                    label: 'Deal Name',
                    type: 'string',
                    fieldType: 'text',
                    description: "Deal's name.",
                    displayOrder: -1,
                    hidden: false,
                    formField: true
                },
                {
                    name: 'amount',
                    label: 'Amount',
                    type: 'number',
                    fieldType: 'number',
                    description: "A deal's amount",
                    displayOrder: 12,
                    hidden: false,
                    formField: true
                }
            ];
            hubspotStub.withArgs('get', 'crm/v3/properties/deals').resolves(mockedResponse);

            const customFieldsSelectArray = await GetDealsProperties.additionalFieldsToSelectArray(mockedResponse);

            assert.equal(customFieldsSelectArray.length, 1, 'Should return only custom fields');
            assert.equal(customFieldsSelectArray[0].label, 'Jirka Notes', 'Should return only custom fields');
        });
    });
});

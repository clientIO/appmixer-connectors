const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../utils.js');
let HubSpot = require('../../src/appmixer/hubspot/Hubspot.js');

describe('CreateDeal', () => {

    const CreateDeal = require('../../src/appmixer/hubspot/crm/CreateDeal/CreateDeal.js');
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

    it('should create deal with custom properties', async function() {

        const createData = {
            dealId: '38533722676',
            dealname: 'My Deal',
            dealstage: 'appointmentscheduled',
            hubSpotOwnerId: 'hs9191919191',
            amount: 1020,
            closedate: (new Date('2022-12-31')).toISOString(),
            pipeline: 'default'
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
            dealname: createData.dealname,
            amount: createData.amount,
            closedate: createData.closedate,
            pipeline: createData.pipeline,
            dealstage: createData.dealstage,
            hubspot_owner_id: createData.hubSpotOwnerId,
            some_custom_property: 'foo',
            another_custom_property: 43
        };

        // Mock the response of Deal creation
        hubspotStub.resolves({
            data: {
                id: createData.dealId,
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-02-04T00:00:00Z',
                properties: expectedData
            }
        });

        await CreateDeal.receive(context);

        assert.equal(hubspotStub.callCount, 1, 'Should make 1 call to create deal');
        // Assert that custom properties were sent to HubSpot
        const createDealArgs = hubspotStub.getCall(0).args;
        assert.equal(createDealArgs[0], 'post', 'Should call post method');
        assert.equal(createDealArgs[1], 'crm/v3/objects/deals', 'Should call correct endpoint');
        assert.deepEqual(createDealArgs[2].properties, expectedData, 'Should send custom properties to HubSpot');
    });
});

const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../utils.js');
let HubSpot = require('../../src/appmixer/hubspot/Hubspot.js');

describe('UpdateDeal', () => {

    const UpdateDeal = require('../../src/appmixer/hubspot/crm/UpdateDeal/UpdateDeal.js');
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

    it('should create and update deal with custom properties', async function() {

        const updateData = {
            dealId: '38533722672',
            dealname: 'My Deal',
            dealstage: 'appointmentscheduled',
            amount: 1000,
            closedate: (new Date('2023-12-31')).toISOString(),
            pipeline: 'default'
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
            dealname: updateData.dealname,
            amount: updateData.amount,
            closedate: updateData.closedate,
            pipeline: updateData.pipeline,
            dealstage: updateData.dealstage,
            some_custom_property: 'foo',
            another_custom_property: 43
        };

        // Mock the response of Deal creation
        hubspotStub.resolves({
            data: {
                id: updateData.dealId,
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-02-04T00:00:00Z',
                properties: expectedData
            }
        });

        await UpdateDeal.receive(context);

        assert.equal(hubspotStub.callCount, 1, 'Should make 1 call to create/update deal');
        // Assert that custom properties were sent to HubSpot
        const updateDealArgs = hubspotStub.getCall(0).args;
        assert.equal(updateDealArgs[0], 'patch', 'Should call patch method');
        assert.equal(updateDealArgs[1], 'crm/v3/objects/deals/' +  updateData.dealId, 'Should call correct endpoint');
        assert.deepEqual(updateDealArgs[2].properties, expectedData, 'Should send custom properties to HubSpot');
    });
});

const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../utils.js');
const NewDeal = require('../../src/appmixer/hubspot/crm/NewDeal/NewDeal.js');

describe('NewDeal', () => {

    let context = testUtils.createMockContext();
    let hubspotStub;

    beforeEach(async () => {

        // Reset the context.
        context = testUtils.createMockContext();
        // Set the profile info.
        context.auth.profileInfo = {
            token: 'CJSP5qf1KhICAQEYs-gDIIGOBii1hQIyGQAf3xBKmlwHjX7OIpuIFEavB2-qYAGQsF4',
            user: 'test@hubspot.com',
            hub_domain: 'demo.hubapi.com',
            scopes: [
                'contacts',
                'automation',
                'oauth'
            ],
            hub_id: 33,
            app_id: 456,
            expires_in: 21588,
            user_id: 123,
            token_type: 'access'
        };
        context.messages = { webhook: { content: { data: null } } };
        // Set the properties to output. If not empty, the component will only output these properties
        // and will not call HubSpot API to get all properties.
        context.properties = { properties: 'amount' };
        // Reset hubspot stub if it was called before
        if (hubspotStub) {
            hubspotStub.restore();
        }
        // Stub the hubspot methods
        hubspotStub = sinon.stub(NewDeal.hubspot, 'call');
    });

    it('should cache outPort schema', async function() {

        // No `properties` in the context so we need to call HubSpot API to get all properties.
        context.properties = {};
        // We receive 10 webhook payloads, one new deal in each payload.
        // We should cache the outPort schema after the first payload.
        const payloads = Array.from({ length: 10 }, (_, i) => {
            return {
                [`${i}`]: {
                    occurredAt: 1726820305517 + i
                }
            };
        });

        // Mock the response of the hubspot call for deal properties
        hubspotStub.withArgs('get', 'crm/v3/properties/deals').resolves({
            data: {
                results: [
                    {
                        name: 'amount',
                        label: 'Amount',
                        type: 'number',
                        fieldType: 'number',
                        readOnlyDefinition: false,
                        hidden: false,
                        options: []
                    }
                ]
            }
        });

        // Mock the response of the hubspot call
        for (const payload of payloads) {
            hubspotStub.withArgs('post', 'crm/v3/objects/deals/batch/read').resolves({
                data: {
                    results: [{
                        id: Object.keys(payload)[0],
                        createdAt: '2023-01-01T00:00:00Z',
                        updatedAt: '2023-01-01T00:00:00Z',
                        amount: '1000' + Object.keys(payload)[0]
                    }]
                }
            });
        }

        for (const payload of payloads) {
            context.messages.webhook.content.data = payload;
            await NewDeal.receive(context);
        }

        assert.equal(hubspotStub.callCount, 11, 'Should make 10 calls to get deal data and 1 call to get deal properties');
    });
});

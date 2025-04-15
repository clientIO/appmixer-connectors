const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../utils.js');
const UpdatedDeal = require('../../src/appmixer/hubspot/crm/UpdatedDeal/UpdatedDeal.js');
const { WATCHED_PROPERTIES_DEAL } = require('../../src/appmixer/hubspot/commons.js');

describe('UpdatedDeal', () => {

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
        context.properties = { properties: 'lastname,firstname,email,phone' };
        context.componentId = 'testComponentId';

        // Reset hubspot stub if it was called before
        if (hubspotStub) {
            hubspotStub.restore();
        }
        hubspotStub = sinon.stub(UpdatedDeal.hubspot, 'call');
    });

    it('created and updated at the same time', async () => {

        context.messages.webhook.content.data = {
            '38533722672': {
                occurredAt: 1726820305517,
                propertyName: 'amount',
                propertyValue: '1000'
            }
        };

        // Mock the response of the hubspot call
        hubspotStub.withArgs('post', 'crm/v3/objects/deals/batch/read').resolves({
            data: {
                results: [
                    {
                        id: '38533722672',
                        createdAt: '2023-01-01T00:00:00Z',
                        updatedAt: '2023-01-01T00:00:00Z',
                        amount: '1000'
                    }
                ]
            }
        });

        await UpdatedDeal.receive(context);

        assert.equal(hubspotStub.callCount, 1);
        assert.equal(hubspotStub.args[0][0], 'post');
        assert.equal(hubspotStub.args[0][1], 'crm/v3/objects/deals/batch/read');

        assert.equal(context.sendArray.callCount, 1);
        assert.equal(context.sendArray.args[0][0].length, 0, 'No changes sent');
        assert.equal(context.response.callCount, 1);
    });

    it('update of ignored property only', async () => {

        context.messages.webhook.content.data = {
            '38533722673': {
                occurredAt: 1726820305517,
                propertyName: 'lastmodifieddate',
                propertyValue: '2023-01-01T00:00:00Z'
            }
        };

        // Mock the response of the hubspot call
        hubspotStub.withArgs('post', 'crm/v3/objects/deals/batch/read').resolves({
            data: {
                results: []
            }
        });

        await UpdatedDeal.receive(context);

        assert.equal(hubspotStub.callCount, 0, 'No call to hubspot');
        assert.equal(context.sendArray.callCount, 0);
        assert.equal(context.response.callCount, 1);
    });

    // HubSpot can trigger multiple updates of the same deal in a short period of time.
    // 1. The first update changes amount
    // 2. The second update changes name
    it('multiple updates of same deal', async () => {

        context.messages.webhook.content.data = {
            '38533722672': {
                occurredAt: 1726820305517,
                propertyName: 'amount',
                propertyValue: '1001'
            }
        };

        // Mock the response of the hubspot call
        hubspotStub.withArgs('post', 'crm/v3/objects/deals/batch/read').resolves({
            data: {
                results: [
                    {
                        id: '38533722672',
                        createdAt: '2023-01-01T00:00:00Z',
                        updatedAt: '2023-01-01T00:00:00Z',
                        amount: '1001',
                        name: 'New Deal Name'
                    }
                ]
            }
        });

        // No data in cache
        context.staticCache.get = sinon.stub().returns(null);

        await UpdatedDeal.receive(context);

        // Deal ID is cached
        assert.equal(context.staticCache.set.callCount, 1);

        context.messages.webhook.content.data = {
            '38533722672': {
                occurredAt: 1726820305517,
                propertyName: 'dealname',
                propertyValue: 'New Deal Name'
            }
        };

        // HubSpot sends the second event few milliseconds after the first one
        // This simulates creating the lock and cache in the first `receive` call
        context.staticCache.get = sinon.stub().returns('1726820305517');
        await UpdatedDeal.receive(context);

        assert.equal(hubspotStub.callCount, 1);
        assert.equal(hubspotStub.args[0][0], 'post');
        assert.equal(hubspotStub.args[0][1], 'crm/v3/objects/deals/batch/read');

        assert.equal(context.sendArray.callCount, 1, 'Only one message sent');
        assert.equal(context.sendArray.args[0][0].length, 0, 'No changes sent');
        assert.equal(context.response.callCount, 2);
    });

    it('getSubscriptions', async () => {

        // Common for both versions
        const subscriptions = UpdatedDeal.getSubscriptions();
        assert.equal(subscriptions.length, WATCHED_PROPERTIES_DEAL.length);
    });

    it('should cache outPort schema', async function() {

        // No `properties` in the context so we need to call HubSpot API to get all properties.
        context.properties = {};
        // We receive 10 webhook payloads, one updated deal in each payload.
        // We should cache the outPort schema after the first payload.
        const payloads = Array.from({ length: 10 }, (_, i) => {
            return {
                [`${i}`]: {
                    occurredAt: 1726820305517 + i,
                    propertyName: 'amount',
                    propertyValue: '1000'
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
            await UpdatedDeal.receive(context);
        }

        assert.equal(hubspotStub.callCount, 11, 'Should make 10 calls to get deal data and 1 call to get deal properties');
    });
});

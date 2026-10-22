const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../../../../../test/utils.js');
const UpdatedContact = require('../../crm/UpdatedContact/UpdatedContact.js');


describe('UpdatedContact', () => {

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
        // Reset hubspot stub if it was called before
        if (hubspotStub) {
            hubspotStub.restore();
        }
        // Stub the hubspot methods
        hubspotStub = sinon.stub(UpdatedContact.hubspot, 'call');
    });

    it('handle CSV import of contacts to update', async () => {

        context.messages.webhook.content.data = {
            '38533722672': {
                occurredAt: 1726820305517,
                propertyName: 'lastname'
            },
            '38533722673': {
                occurredAt: 1726820305517,
                propertyName: 'firstname'
            },
            '38533722674': {
                occurredAt: 1726820305517,
                propertyName: 'email'
            },
            '38533722675': {
                occurredAt: 1726820305517,
                propertyName: 'phone'
            }
        };

        // Mock the response of the hubspot call
        hubspotStub.withArgs('post', 'crm/v3/objects/contacts/batch/read').resolves({
            data: {
                results: [
                    {
                        id: '38533722672',
                        createdAt: '2023-01-01T00:00:00Z',
                        updatedAt: '2023-02-04T00:00:00Z'
                    },
                    {
                        id: '38533722673',
                        createdAt: '2023-01-01T00:00:00Z',
                        updatedAt: '2023-02-04T00:00:00Z'
                    },
                    {
                        id: '38533722674',
                        createdAt: '2023-01-01T00:00:00Z',
                        updatedAt: '2023-02-04T00:00:00Z'
                    },
                    {
                        id: '38533722675',
                        createdAt: '2023-01-01T00:00:00Z',
                        updatedAt: '2023-02-04T00:00:00Z'
                    }
                ]
            }
        });

        await UpdatedContact.receive(context);

        assert.equal(hubspotStub.callCount, 1);
        assert.equal(hubspotStub.args[0][0], 'post');
        assert.equal(hubspotStub.args[0][1], 'crm/v3/objects/contacts/batch/read');

        assert.equal(context.sendArray.callCount, 1);
        assert.equal(context.sendArray.args[0][0].length, 4, '4 changes sent');
        assert.equal(context.response.callCount, 1);
    });

    // HubSpot can trigger multiple updates of the same contact in a short period of time.
    // 1. The first update changes firstname
    // 2. The second update changes lastname
    it('multiple updates of same contact', async () => {

        context.messages.webhook.content.data = {
            '38533722679': {
                occurredAt: 1726820305517,
                propertyName: 'firstname',
                propertyValue: 'john'
            }
        };

        // Mock the response of the hubspot call
        hubspotStub.withArgs('post', 'crm/v3/objects/contacts/batch/read').resolves({
            data: {
                results: [
                    {
                        id: '38533722679',
                        createdAt: '2023-01-01T00:00:00Z',
                        updatedAt: '2023-01-01T00:00:00Z',
                        firstname: 'John',
                        lastname: 'Doe'
                    }
                ]
            }
        });

        // No data in cache
        context.staticCache.get = sinon.stub().returns(null);

        await UpdatedContact.receive(context);

        // Contact ID is cached
        assert.equal(context.staticCache.set.callCount, 1);

        context.messages.webhook.content.data = {
            '38533722679': {
                occurredAt: 1726820305666,
                propertyName: 'lastname',
                propertyValue: 'Doe'
            }
        };

        // HubSpot sends the second event few milliseconds after the first one
        // This simulates creating the lock and cache in the first `receive` call
        context.staticCache.get = sinon.stub().returns('1726820305666');
        await UpdatedContact.receive(context);

        assert.equal(hubspotStub.callCount, 1);
        assert.equal(hubspotStub.args[0][0], 'post');
        assert.equal(hubspotStub.args[0][1], 'crm/v3/objects/contacts/batch/read');

        assert.equal(context.sendArray.callCount, 1, 'Only one message sent');
        assert.equal(context.sendArray.args[0][0].length, 0, 'No changes sent');
        assert.equal(context.response.callCount, 2);
    });

    it('lifecyclestage change triggers update', async () => {

        context.messages.webhook.content.data = {
            '38533722680': {
                occurredAt: 1726820305517,
                propertyName: 'lifecyclestage',
                propertyValue: 'evangelist'
            }
        };

        hubspotStub.withArgs('post', 'crm/v3/objects/contacts/batch/read').resolves({
            data: {
                results: [
                    {
                        id: '38533722680',
                        createdAt: '2023-01-01T00:00:00Z',
                        updatedAt: '2023-02-04T00:00:00Z',
                        properties: { lifecyclestage: 'evangelist' }
                    }
                ]
            }
        });

        await UpdatedContact.receive(context);

        assert.equal(hubspotStub.callCount, 1, 'HubSpot API called');
        assert.equal(context.sendArray.callCount, 1);
        assert.equal(context.sendArray.args[0][0].length, 1, 'lifecyclestage change emitted');
        assert.equal(context.response.callCount, 1);
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
                    propertyName: 'lastname',
                    propertyValue: 'Doe-' + i
                }
            };
        });

        // Mock the response of the hubspot call for deal properties
        hubspotStub.withArgs('get', 'crm/v3/properties/contacts').resolves({
            data: {
                results: [
                    {
                        name: 'lastname',
                        label: 'Last Name',
                        type: 'string',
                        fieldType: 'text',
                        groupName: 'contactinformation',
                        options: []
                    },
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
                    },
                    {
                        name: 'phone',
                        label: 'Phone Number',
                        type: 'string',
                        fieldType: 'text',
                        groupName: 'contactinformation',
                        options: []
                    }
                ]
            }
        });
        // Mock the response of the hubspot call
        for (const payload of payloads) {
            hubspotStub.withArgs('post', 'crm/v3/objects/contacts/batch/read').resolves({
                data: {
                    results: [{
                        id: Object.keys(payload)[0],
                        createdAt: '2023-01-01T00:00:00Z',
                        updatedAt: '2023-01-01T00:00:00Z',
                        lastname: 'Doe-' + Object.keys(payload)[0]
                    }]
                }
            });
        }

        for (const payload of payloads) {
            context.messages.webhook.content.data = payload;
            await UpdatedContact.receive(context);
        }

        assert.equal(hubspotStub.callCount, 11, 'Should make 10 calls to get contact data and 1 call to get contact properties');
    });

    it('two flows receive the same change (the dedupe cache is per component)', async () => {

        // staticCache is shared by all component instances.
        const cache = new Map();
        context.staticCache = {
            get: async (key) => cache.get(key),
            set: async (key, value) => {
                cache.set(key, value);
            }
        };
        context.messages.webhook.content.data = {
            '104': { occurredAt: 1726820305517, propertyName: 'firstname' }
        };
        hubspotStub.withArgs('post', 'crm/v3/objects/contacts/batch/read').resolves({
            data: {
                results: [{ id: '104', createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-02-04T00:00:00Z' }]
            }
        });

        context.componentId = 'flow-a-updated-contact';
        await UpdatedContact.receive(context);
        context.componentId = 'flow-b-updated-contact';
        await UpdatedContact.receive(context);

        assert.equal(context.sendArray.callCount, 2, 'both flows fire');
        assert.equal(context.sendArray.args[1][0].length, 1, 'second flow gets the contact too');
    });
});

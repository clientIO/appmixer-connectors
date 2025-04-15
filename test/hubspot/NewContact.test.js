const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../utils.js');
const NewContact = require('../../src/appmixer/hubspot/crm/NewContact/NewContact.js');

describe('NewContact', () => {

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
        hubspotStub = sinon.stub(NewContact.hubspot, 'call');
    });

    // HubSpot can trigger the same create event multiple times
    it('multiple creation of the same contact', async () => {

        context.messages.webhook.content.data = {
            '166332965081': {
                occurredAt: 1726820335517
            }
        };

        // Mock the response of the hubspot call
        hubspotStub.withArgs('post', 'crm/v3/objects/contacts/batch/read').resolves({
            data: {
                results: [
                    {
                        id: '166332965081',
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

        await NewContact.receive(context);

        // Contact ID is cached
        assert.equal(context.staticCache.set.callCount, 1);

        // The same message arrives again
        context.messages.webhook.content.data = {
            '166332965081': {
                occurredAt: 1726820335517
            }
        };

        // HubSpot sends the second event few milliseconds after the first one
        // This simulates creating cache in the first `receive` call
        context.staticCache.get = sinon.stub().returns('166332965081');
        await NewContact.receive(context);

        assert.equal(hubspotStub.callCount, 1);
        assert.equal(hubspotStub.args[0][0], 'post');
        assert.equal(hubspotStub.args[0][1], 'crm/v3/objects/contacts/batch/read');

        assert.equal(context.sendArray.callCount, 1, 'Only one message sent');
        assert.equal(context.sendArray.args[0][0].length, 1, 'One new contact sent');
        assert.equal(context.response.callCount, 2);
    });

    it('should cache outPort schema', async function() {

        // No `properties` in the context so we need to call HubSpot API to get all properties.
        context.properties = {};
        // We receive 10 webhook payloads, one new contact in each payload.
        // We should cache the outPort schema after the first payload.
        const payloads = Array.from({ length: 10 }, (_, i) => {
            return {
                [`${i}`]: {
                    occurredAt: 1726820305517 + i
                }
            };
        });

        // Mock the response of the hubspot call for contact properties
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
            await NewContact.receive(context);
        }

        assert.equal(hubspotStub.callCount, 11, 'Should make 10 calls to get contact data and 1 call to get contact properties');
    });
});

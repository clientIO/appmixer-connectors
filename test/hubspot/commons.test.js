const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../utils.js');
let HubSpot = require('../../src/appmixer/hubspot/Hubspot.js');

describe('commons.js', () => {

    let context = testUtils.createMockContext();
    let hubspotStub;

    beforeEach(async () => {

        // Reset the context.
        context = testUtils.createMockContext();
        context.messages = { in: { content: {} } };
        context.config = {
            objectPropertiesCacheTTL: 1
        };
        // Reset hubspot stub if it was called before
        if (hubspotStub) {
            hubspotStub.restore();
        }
        // Stub the hubspot methods
        hubspotStub = sinon.stub(HubSpot.prototype, 'call');
    });

    it('should mark custom properties with a suffix', async () => {

        const { getObjectProperties } = require('../../src/appmixer/hubspot/commons');
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
        hubspotStub.withArgs('get', 'crm/v3/properties/contacts').resolves({ data: { results: mockedResponse } });

        const properties = await getObjectProperties(context, { call: hubspotStub }, 'contacts');
        assert(properties.length > 0);
        assert.equal(properties[0].label, 'Jirka Notes [custom]', 'Custom field should have [custom] suffix');
        assert.equal(properties[1].label, 'Job Title', 'Non custom field should not have [custom] suffix');
    });
});

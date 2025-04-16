const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../utils.js');
let HubSpot = require('../../src/appmixer/hubspot/Hubspot.js');

describe('ListPipelineStages', () => {

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
        hubspotStub = sinon.stub(HubSpot.prototype, 'call').resolves({
            data: {
                results: [
                    {
                        id: '123',
                        label: 'Test Stage',
                        displayOrder: 1,
                        metadata: {
                            probability: 0.5
                        }
                    }
                ]
            }
        });
    });

    describe('source', () => {

        it('should not throw when used as a `source`', async function() {

            // The require is inside the test because we need to stub the call method
            const ListPipelineStages = require('../../src/appmixer/hubspot/crm/ListPipelineStages/ListPipelineStages.js');

            context.messages = {
                in: {
                    content: {
                        // pipelineId: '123',
                        isSource: true
                    }
                }
            };

            await ListPipelineStages.receive(context);

            assert.equal(hubspotStub.callCount, 0, 'Should not call the hubspot API without pipelineId');
            // Check the outPort schema
            const sendJsonArgs = context.sendJson.getCall(0).args;
            assert.deepEqual(sendJsonArgs[0].stages, [], 'Should not send any data');
        });

        it('should not throw when used as a `source`', async function() {

            // The require is inside the test because we need to stub the call method
            const ListPipelineStages = require('../../src/appmixer/hubspot/crm/ListPipelineStages/ListPipelineStages.js');

            context.messages = {
                in: {
                    content: {
                        pipelineId: '123'
                    }
                }
            };

            await ListPipelineStages.receive(context);

            assert.equal(hubspotStub.callCount, 1, 'Should call the hubspot API with pipelineId');
            assert.equal(hubspotStub.getCall(0).args[1], 'crm/v3/pipelines/deals/123/stages', 'Should call the correct endpoint');
            // Check the outPort schema
            const sendJsonArgs = context.sendJson.getCall(0).args;
            assert.deepEqual(sendJsonArgs[0].stages[0].id, '123', 'Should send the data');
        });
    });
});

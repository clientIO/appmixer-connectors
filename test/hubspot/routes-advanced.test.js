const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../utils.js');
const routes = require('../../src/appmixer/hubspot/routes.js');

// Single scenario:
// New Deal is created in HubSpot with a specific amount and deal name and stage and close date.
// HubSpot triggers the following event:
// 1. Deal creation
// 2. Deal property amount changed
// 3. Deal property dealstage changed
// 4. Deal property dealname changed
// 5. Deal property pipeline changed
// 6. Deal property closedate changed
// These events are sent to Appmixer in several batches, in this example we will simulate the following:
// Events 2 and 3 are sent in the first batch (updates only)
// Events 1, 4, 5 and 6 are sent in the second batch (creation and updates)
// Expected result: Appmixer should trigger only for New Deal creation event if the event is sent "soon" after the property changes.
// What is "soon"? We will define it as 2 seconds.
describe('POST /events handler advanced', () => {

    let context = testUtils.createMockContext();
    let handler;

    beforeEach(async () => {

        // Reset the context
        context = {
            ...testUtils.createMockContext(),
            // Routes/plugins specific stubs
            http: {
                router: {
                    register: sinon.stub()
                }
            }
        };

        // Register the routes the same way Appmixer does.
        await routes(context);
        // Get the right handler for the POST /events route - our HubSpot triggers.
        handler = context.http.router.register.getCall(0).args[0].options.handler;
        // Stubs common to all tests. v4
        context.triggerComponent.resolves();
    });

    it('ignore update events fired with create event', async function() {

        // Fixtures
        const req1 = {
            payload: [
                {
                    eventId: 3313558930,
                    subscriptionId: 3117550,
                    portalId: 154661564,
                    appId: 3220555,
                    occurredAt: 1737447084866,
                    subscriptionType: 'deal.propertyChange',
                    attemptNumber: 0,
                    objectId: 108008343753,
                    propertyName: 'amount',
                    propertyValue: '666',
                    changeSource: 'INTEGRATION',
                    sourceId: '3220555'
                },
                {
                    eventId: 623346684,
                    subscriptionId: 3117546,
                    portalId: 154661564,
                    appId: 3220555,
                    occurredAt: 1737447084866,
                    subscriptionType: 'deal.propertyChange',
                    attemptNumber: 0,
                    objectId: 108008343753,
                    propertyName: 'dealstage',
                    propertyValue: 'appointmentscheduled',
                    changeSource: 'INTEGRATION',
                    sourceId: '3220555'
                }
            ]
        };

        const req2 = {
            payload: [
                {
                    eventId: 2298890858,
                    subscriptionId: 3117545,
                    portalId: 154661564,
                    appId: 3220555,
                    occurredAt: 1737447084866,
                    subscriptionType: 'deal.propertyChange',
                    attemptNumber: 0,
                    objectId: 108008343753,
                    propertyName: 'dealname',
                    propertyValue: 'New deal 1737447084',
                    changeSource: 'INTEGRATION',
                    sourceId: '3220555'
                },
                {
                    eventId: 2801075737,
                    subscriptionId: 3117544,
                    portalId: 154661564,
                    appId: 3220555,
                    occurredAt: 1737447084866,
                    subscriptionType: 'deal.creation',
                    attemptNumber: 0,
                    objectId: 108008343753,
                    changeFlag: 'CREATED',
                    changeSource: 'INTEGRATION',
                    sourceId: '3220555'
                },
                {
                    eventId: 2745776837,
                    subscriptionId: 3117547,
                    portalId: 154661564,
                    appId: 3220555,
                    occurredAt: 1737447084866,
                    subscriptionType: 'deal.propertyChange',
                    attemptNumber: 0,
                    objectId: 108008343753,
                    propertyName: 'pipeline',
                    propertyValue: 'default',
                    changeSource: 'INTEGRATION',
                    sourceId: '3220555'
                },
                {
                    eventId: 1098120383,
                    subscriptionId: 3117549,
                    portalId: 154661564,
                    appId: 3220555,
                    occurredAt: 1737447084866,
                    subscriptionType: 'deal.propertyChange',
                    attemptNumber: 0,
                    objectId: 108008343753,
                    propertyName: 'closedate',
                    propertyValue: '2033935200000',
                    changeSource: 'INTEGRATION',
                    sourceId: '3220555'
                }
            ]
        };

        const clock = sinon.useFakeTimers();
        // Call the handlers at the same time
        await handler(req1);
        await handler(req2);

        // Expecting no calls yet to triggerListeners, this is the time when the events are received.
        assert.equal(context.triggerListeners.callCount, 0, 'triggerListeners should not be called yet');

        // Jump 6 seconds into the future to trigger delayed events
        await clock.tickAsync(6000);
        console.log('Jumped 6 seconds into the future');

        // Assertions
        // Expecting 1 call to triggerListeners, only for the deal creation event.
        assert.equal(context.triggerListeners.callCount, 1, 'triggerListeners should be called once');
        const triggerListenersArgsExpected = {
            eventName: 'deal.creation:154661564',
            payload: { '108008343753': req2.payload[1] }
        };

        assert(
            context.triggerListeners.calledWith(triggerListenersArgsExpected),
            'triggerListeners should be called with the correct arguments'
        );

        // Some records should be cached in MongoDB
        assert.equal(Object.keys(global.serviceState).length, 1, 'Some records should be cached in MongoDB');
        // Assert the value of the first key
        const key = Object.keys(global.serviceState)[0];
        assert.equal(global.serviceState[key], 1737447084866, 'The first key should have the correct value');

        // Jump another 6 seconds into the future to make sure the records are not cached in MongoDB
        await clock.tickAsync(6000);
        console.log('Jumped another 6 seconds into the future');

        // Still expecting 1 call to triggerListeners, only for the deal creation event.
        assert.equal(context.triggerListeners.callCount, 1, 'triggerListeners should be called once');

        // No records should be cached in MongoDB
        assert.equal(Object.keys(global.serviceState).length, 0, 'No records should be cached in MongoDB');
    });
});

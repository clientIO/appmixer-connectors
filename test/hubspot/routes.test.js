const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../utils.js');
const routes = require('../../src/appmixer/hubspot/routes');
const { version } = require('../../src/appmixer/hubspot/bundle.json');

describe('POST /events handler', () => {

    let context = testUtils.createMockContext();
    let handler;

    // Fixtures
    // A single OAuth app has 3 users (HubSpot accounts): Airbus, Boeing and Cessna.
    const PORTAL_ID_AIRBUS = 33;

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
            // v3
        };

        // Register the routes the same way Appmixer does.
        await routes(context);
        // Get the right handler for the POST /events route - our HubSpot triggers.
        handler = context.http.router.register.getCall(version.startsWith('4') ? 0 : 2).args[0].options.handler;
        // Stubs common to all tests. v4
        context.triggerComponent.resolves();
    });

    if (version.startsWith('4')) {
        it('call to context.onListenerAdded should register the trigger in HubSpot', async () => {

            // Stub the HTTP requests to HubSpot.
            // First is to get all webhook subscriptions
            context.httpRequest.onCall(0).resolves({
                statusCode: 200,
                data: {
                    results: []
                }
            });
            // Second is to create a new webhook subscriptions
            context.httpRequest.onCall(1).resolves({
                statusCode: 200
            });

            const handler = context.onListenerAdded.getCall(0).args[0];
            await handler(
                {
                    eventName: 'contact.creation:33',
                    url: 'https://api.foo.appmixer.cloud/flows/2fe6d046-aaaa-4375-94f0-7f06c3e22536/components/9929ac7b-aaaa-433a-b654-cba6cec3293a',
                    params: {
                        apiKey: 'eu1-aaaa-bbbb-4e82-dddd-22e0d0dd09b6',
                        appId: '1234585'
                    }
                }
            );
            assert.equal(context.httpRequest.callCount, 2, 'httpRequest should be called twice');
        });
    }

    it('no call to triggerComponent', async () => {

        // The payload contains 2 events for the same user Airbus:
        // Both events are of type contact.propertyChange that we are not interested in.
        const req = {
            payload: [
                {
                    eventId: 841732359,
                    subscriptionId: 2921817,
                    portalId: PORTAL_ID_AIRBUS,
                    appId: 2036647,
                    occurredAt: 1726820305517,
                    subscriptionType: 'contact.propertyChange',
                    attemptNumber: 0,
                    objectId: 38533722672,
                    propertyName: 'hubspot_owner_id',
                    propertyValue: '1246609022',
                    changeSource: 'CRM_UI',
                    sourceId: 'test-unit'
                },
                {
                    eventId: 3114348649,
                    subscriptionId: 2921816,
                    portalId: PORTAL_ID_AIRBUS,
                    appId: 2036647,
                    occurredAt: 1726820305517,
                    subscriptionType: 'contact.propertyChange',
                    attemptNumber: 0,
                    objectId: 38533722672,
                    propertyName: 'hubspot_owner_assigneddate',
                    propertyValue: '1726820305522',
                    changeSource: 'CRM_UI',
                    sourceId: 'test-unit'
                }
            ]
        };

        // Call the handler with the payload.
        await handler(req);

        // Assertions
        // Expecting no calls to triggerListeners.
        assert.equal(context.triggerListeners.callCount, 0, 'triggerListeners should not be called');
    });

    it('multiple changes of the same contact in a single event', async () => {

        // Fixtures
        const PORTAL_ID_AIRBUS = 33;
        const req = {
            payload: [
                // 2x changes that we are not interested in.
                {
                    eventId: 841732359,
                    subscriptionId: 2921817,
                    portalId: PORTAL_ID_AIRBUS,
                    appId: 2036647,
                    occurredAt: 1726820305517,
                    subscriptionType: 'contact.propertyChange',
                    attemptNumber: 0,
                    objectId: 38533722672,
                    propertyName: 'hubspot_owner_id',
                    propertyValue: '1246609022',
                    changeSource: 'CRM_UI',
                    sourceId: 'test-unit'
                },
                {
                    eventId: 3114348649,
                    subscriptionId: 2921816,
                    portalId: PORTAL_ID_AIRBUS,
                    appId: 2036647,
                    occurredAt: 1726820305517,
                    subscriptionType: 'contact.propertyChange',
                    attemptNumber: 0,
                    objectId: 38533722672,
                    propertyName: 'hubspot_owner_assigneddate',
                    propertyValue: '1726820305522',
                    changeSource: 'CRM_UI',
                    sourceId: 'test-unit'
                },
                // 1x change that we are interested in.
                {
                    eventId: 3114348649,
                    subscriptionId: 2921816,
                    portalId: PORTAL_ID_AIRBUS,
                    appId: 2036647,
                    occurredAt: 1726820305517,
                    subscriptionType: 'contact.propertyChange',
                    attemptNumber: 0,
                    objectId: 38533722672,
                    propertyName: 'firstname',
                    propertyValue: 'Andrew',
                    changeSource: 'CRM_UI',
                    sourceId: 'test-unit'
                },
                {
                    eventId: 3114348649,
                    subscriptionId: 2921816,
                    portalId: PORTAL_ID_AIRBUS,
                    appId: 2036647,
                    occurredAt: 1726820305517,
                    subscriptionType: 'contact.propertyChange',
                    attemptNumber: 0,
                    objectId: 38533722672,
                    propertyName: 'hubspot_owner_assigneddate',
                    propertyValue: '1726820305522',
                    changeSource: 'CRM_UI',
                    sourceId: 'test-unit'
                }
            ]
        };

        // Stubs v3
        context.service.stateGet.onCall(0).returns([
            { flowId: 'flowA', componentId: 'updated-contact-2' }
        ]);

        const clock = sinon.useFakeTimers();
        // Call the handler with the payload.
        await handler(req);

        // Jump 6 seconds into the future to trigger delayed events
        await clock.tickAsync(6000);

        // Assertions
        // Expecting 1 call to triggerListeners, only for the user Airbus.
        if (version.startsWith('4')) {
            assert.equal(context.triggerListeners.callCount, 1, 'triggerListeners should be called once');
        } else {
            assert.equal(context.triggerComponent.callCount, 1, 'triggerComponent should be called once');
        }

        // Expecting the call to triggerListeners to be with the correct arguments.
        if (version.startsWith('4')) {
            const triggerListenersArgsExpected = [
                [
                    {
                        eventName: `contact.propertyChange:${PORTAL_ID_AIRBUS}`,
                        payload: { '38533722672': req.payload[2] }
                    }
                ]
            ];
            assert(
                context.triggerListeners.calledWith(...triggerListenersArgsExpected[0]),
                'triggerListeners should be called with the correct arguments'
            );
        } else {
            const triggerComponentArgsExpected = [
                // flowid, componentid, payload
                'flowA',
                'updated-contact-2',
                {
                    '38533722672': req.payload[2]
                }
            ];

            // Assert flowId
            assert.equal(
                context.triggerComponent.getCall(0).args[0],
                triggerComponentArgsExpected[0],
                'should be called with correct flowId'
            );
            // Assert componentId
            assert.equal(
                context.triggerComponent.getCall(0).args[1],
                triggerComponentArgsExpected[1],
                'should be called with correct componentId'
            );
            // Assert payload
            assert.deepEqual(
                context.triggerComponent.getCall(0).args[2],
                triggerComponentArgsExpected[2],
                'should be called with correct payload'
            );
        }
    });

    it('CSV import of multiple contacts', async () => {

        // Fixtures
        const req = {
            payload: [
                // 3x new contact
                {
                    eventId: 841732359,
                    subscriptionId: 2921817,
                    portalId: PORTAL_ID_AIRBUS,
                    appId: 2036647,
                    occurredAt: 1726820305517,
                    subscriptionType: 'contact.creation',
                    attemptNumber: 0,
                    objectId: 38533722672,
                    changeSource: 'CRM_UI',
                    sourceId: 'test-unit'
                },
                {
                    eventId: 3114348649,
                    subscriptionId: 2921816,
                    portalId: PORTAL_ID_AIRBUS,
                    appId: 2036647,
                    occurredAt: 1726820305517,
                    subscriptionType: 'contact.creation',
                    attemptNumber: 0,
                    objectId: 38533722673,
                    changeSource: 'CRM_UI',
                    sourceId: 'test-unit'
                },
                {
                    eventId: 3114348649,
                    subscriptionId: 2921816,
                    portalId: PORTAL_ID_AIRBUS,
                    appId: 2036647,
                    occurredAt: 1726820305517,
                    subscriptionType: 'contact.creation',
                    attemptNumber: 0,
                    objectId: 38533722674,
                    changeSource: 'CRM_UI',
                    sourceId: 'test-unit'
                }
            ]
        };

        // Stubs v3
        context.service.stateGet.onCall(0).returns([
            { flowId: 'flowA', componentId: 'updated-contact-2' }
        ]);

        const clock = sinon.useFakeTimers();
        // Call the handler with the payload.
        await handler(req);

        // Jump 6 seconds into the future to trigger delayed events
        await clock.tickAsync(6000);

        // Assertions
        if (version.startsWith('4')) {
            // Expecting 1 call to triggerListeners with 3 new contacts.
            assert.equal(context.triggerListeners.callCount, 1, 'triggerListeners should be called once');
            // Expecting the call to triggerListeners to be with the correct arguments.
            const triggerListenersArgsExpected = [
                [
                    {
                        eventName: `contact.creation:${PORTAL_ID_AIRBUS}`,
                        payload: {
                            '38533722672': req.payload[0],
                            '38533722673': req.payload[1],
                            '38533722674': req.payload[2]
                        }
                    }
                ]
            ];
            assert(
                context.triggerListeners.calledWith(...triggerListenersArgsExpected[0]),
                'triggerListeners should be called with the correct arguments'
            );
        } else {
            // Expecting 1 call to triggerComponent with 3 new contacts.
            assert.equal(context.triggerComponent.callCount, 1, 'triggerComponent should be called 3 times');
            // Expecting the call to triggerComponent to be with the correct arguments.
            const triggerComponentArgsExpected = [
                // flowid, componentid, payload
                'flowA',
                'updated-contact-2',
                {
                    '38533722672': req.payload[0],
                    '38533722673': req.payload[1],
                    '38533722674': req.payload[2]
                }
            ];
            // Assert flowId
            assert.equal(
                context.triggerComponent.getCall(0).args[0],
                triggerComponentArgsExpected[0],
                'should be called with correct flowId'
            );
            // Assert componentId
            assert.equal(
                context.triggerComponent.getCall(0).args[1],
                triggerComponentArgsExpected[1],
                'should be called with correct componentId'
            );
            // Assert payload
            assert.deepEqual(
                context.triggerComponent.getCall(0).args[2],
                triggerComponentArgsExpected[2],
                'should be called with correct payload'
            );
        }
    });
});


const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../../../../../test/utils.js');
const routes = require('../../routes');
const { version } = require('../../bundle.json');
const { signedRequest, h, CLIENT_SECRET, API_URL } = require('./signedRequest');

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
            },
            config: { clientSecret: CLIENT_SECRET },
            appmixerApiUrl: API_URL
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

        it('onListenerAdded subscribes to the ContactPropertyChanged property on top of the defaults', async () => {

            // Existing subscriptions of the app: `email` is already there.
            context.httpRequest.onCall(0).resolves({
                data: {
                    results: [
                        { id: 1, eventType: 'contact.propertyChange', propertyName: 'email', active: true }
                    ]
                }
            });
            context.httpRequest.onCall(1).resolves({ statusCode: 200 });

            const listenerHandler = context.onListenerAdded.getCall(0).args[0];
            await listenerHandler({
                eventName: 'contact.propertyChange:33',
                params: { apiKey: 'dev-api-key', appId: '1234585', propertyName: 'my_custom_field' }
            });

            assert.equal(context.httpRequest.callCount, 2, 'list + batch create');
            const created = context.httpRequest.getCall(1).args[0].data
                .map(sub => sub.subscriptionDetails.propertyName);
            assert(created.includes('my_custom_field'), 'custom property subscribed');
            assert(created.includes('firstname'), 'default properties subscribed');
            assert(!created.includes('email'), 'existing subscription not created again');
        });

        it('onListenerAdded re-activates an inactive subscription (v3 `active` flag)', async () => {

            // Every default exists; `email` is switched off, the rest are active.
            const defaults = ['email', 'firstname', 'lastname', 'phone', 'website', 'company', 'address', 'city', 'state', 'zip'];
            context.httpRequest.onCall(0).resolves({
                data: {
                    results: defaults.map((propertyName, index) => ({
                        id: 100 + index,
                        eventType: 'contact.propertyChange',
                        propertyName,
                        active: propertyName !== 'email'
                    }))
                }
            });
            context.httpRequest.resolves({ statusCode: 200, data: {} });

            const listenerHandler = context.onListenerAdded.getCall(0).args[0];
            await listenerHandler({
                eventName: 'contact.propertyChange:33',
                params: { apiKey: 'dev-api-key', appId: '1234585' }
            });

            assert.equal(context.httpRequest.callCount, 2, 'list + one PATCH, nothing created');
            const patch = context.httpRequest.getCall(1).args[0];
            assert.equal(patch.method, 'PATCH');
            assert(patch.url.includes('/subscriptions/100?'), 'the inactive email subscription');
            assert.deepEqual(patch.data, { active: true });
        });

        it('onListenerAdded does nothing on the AuthHub pod (the shared app is configured manually)', async () => {

            const originalUrl = process.env.AUTH_HUB_URL;
            const originalToken = process.env.AUTH_HUB_TOKEN;
            process.env.AUTH_HUB_URL = 'https://auth-hub.example.com';
            delete process.env.AUTH_HUB_TOKEN;
            try {
                context.config = { apiKey: 'authhub-dev-key', appId: '999' };
                const listenerHandler = context.onListenerAdded.getCall(0).args[0];
                await listenerHandler({ eventName: 'contact.propertyChange:33', params: { propertyName: 'my_custom_field' } });
                await listenerHandler({ eventName: 'contact.creation:33', params: {} });

                assert.equal(context.httpRequest.callCount, 0, 'no HubSpot call');
            } finally {
                if (originalUrl === undefined) {
                    delete process.env.AUTH_HUB_URL;
                } else {
                    process.env.AUTH_HUB_URL = originalUrl;
                }
                if (originalToken !== undefined) {
                    process.env.AUTH_HUB_TOKEN = originalToken;
                }
            }
        });
    }

    describe('signature verification', () => {

        const payload = [{
            eventId: 1,
            portalId: PORTAL_ID_AIRBUS,
            occurredAt: 1726820305517,
            subscriptionType: 'contact.creation',
            objectId: 38533722672
        }];

        it('accepts a valid signature', async () => {

            const clock = sinon.useFakeTimers({ now: 1726820305517 });
            const response = await handler(signedRequest(payload), h);
            await clock.tickAsync(6000);
            clock.restore();

            assert.deepEqual(response, {});
            assert.equal(context.triggerListeners.callCount, 1);
        });

        it('accepts a signature computed with the forwarded public URL', async () => {

            context.appmixerApiUrl = undefined;
            const clock = sinon.useFakeTimers({ now: 1726820305517 });
            const req = signedRequest(payload);
            req.headers['x-forwarded-proto'] = 'https';
            req.headers['x-forwarded-host'] = 'api.appmixer.example.com';

            const response = await handler(req, h);
            await clock.tickAsync(6000);
            clock.restore();
            assert.deepEqual(response, {});
            assert.equal(context.triggerListeners.callCount, 1);
        });

        it('rejects a request without a signature', async () => {

            const req = signedRequest(payload);
            delete req.headers['x-hubspot-signature-v3'];

            const response = await handler(req, h);
            assert.equal(response.statusCode, 401);
        });

        it('rejects a request signed with another secret', async () => {

            const response = await handler(signedRequest(payload, { secret: 'attacker' }), h);
            assert.equal(response.statusCode, 401);
        });

        it('rejects a tampered body', async () => {

            const req = signedRequest(payload);
            req.payload = Buffer.from(JSON.stringify([{ ...payload[0], portalId: 999 }]));

            const response = await handler(req, h);
            assert.equal(response.statusCode, 401);
        });

        it('rejects an old timestamp', async () => {

            const response = await handler(signedRequest(payload, { timestamp: Date.now() - 6 * 60 * 1000 }), h);
            assert.equal(response.statusCode, 401);
        });

        it('rejects every request when the client secret is not configured', async () => {

            context.config = {};
            const response = await handler(signedRequest(payload), h);
            assert.equal(response.statusCode, 401);
        });
    });

    it('all propertyChange events pass through to triggerListeners', async () => {

        // All propertyChange events now pass through regardless of property name.
        // Individual components apply their own filtering in receive().
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

        const clock = sinon.useFakeTimers();
        await handler(signedRequest(req.payload), h);
        await clock.tickAsync(6000);

        // triggerListeners should be called — all propertyChange events now pass through
        assert.equal(context.triggerListeners.callCount, 1, 'triggerListeners should be called once');
        const call = context.triggerListeners.getCall(0).args[0];
        assert.equal(call.eventName, `contact.propertyChange:${PORTAL_ID_AIRBUS}`);
        // The last event per objectId, plus every property of the object that changed in the batch.
        assert.deepEqual(call.payload, {
            '38533722672': { ...req.payload[1], propertyNames: ['hubspot_owner_id', 'hubspot_owner_assigneddate'] }
        });
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
        await handler(signedRequest(req.payload), h);

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
        // All propertyChange events pass through (no allowlist filter), grouped by objectId: the last event
        // per object plus `propertyNames` with every property changed in the batch — firstname included,
        // although it is not the last change, so triggers filtering by property do not miss it.
        if (version.startsWith('4')) {
            const triggerListenersArgsExpected = [
                [
                    {
                        eventName: `contact.propertyChange:${PORTAL_ID_AIRBUS}`,
                        payload: {
                            '38533722672': {
                                ...req.payload[3],
                                propertyNames: ['hubspot_owner_id', 'hubspot_owner_assigneddate', 'firstname']
                            }
                        }
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
                    '38533722672': req.payload[3]
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
        await handler(signedRequest(req.payload), h);

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


const { webhookHandler } = require('../../routes');
const assert = require('assert');
const sinon = require('sinon');
const crypto = require('crypto');
const testUtils = require('../../../../../test/utils.js');

// Fixtures
const NOW = new Date();
const REALM_ID_AIRBUS = '1185883450';
const REALM_ID_BOEING = '1185883451';
const CUSTOMER_A_CREATED = { id: '1', name: 'Customer', operation: 'Create', lastUpdated: NOW };
const CUSTOMER_B_CREATED = { id: '2', name: 'Customer', operation: 'Create', lastUpdated: NOW };
const CUSTOMER_C_CREATED = { id: '3', name: 'Customer', operation: 'Create', lastUpdated: NOW };
const CUSTOMER_D_CREATED = { id: '4', name: 'Customer', operation: 'Create', lastUpdated: NOW };
const CUSTOMER_E_UPDATED = { id: '5', name: 'Customer', operation: 'Update', lastUpdated: NOW };
const INVOICE_A1_CREATED = { id: '1001', name: 'Invoice', operation: 'Create', lastUpdated: NOW };
const INVOICE_A2_CREATED = { id: '1002', name: 'Invoice', operation: 'Create', lastUpdated: NOW };
const INVOICE_B1_CREATED = { id: '1003', name: 'Invoice', operation: 'Create', lastUpdated: NOW };
const INVOICE_B2_CREATED = { id: '1004', name: 'Invoice', operation: 'Create', lastUpdated: NOW };

describe('Quickbooks webhooks', function() {

    let context;
    let req;
    let h;

    beforeEach(function() {

        context = {
            ...testUtils.createMockContext(),
            config: {
                webhookVerifierToken: 'webhooksVerifier'
            },
            profileInfo: {
                companyId: 'companyId'
            }
        };
        // Hapi request object
        req = {
            payload: {},
            query: {},
            info: {
                hostname: 'hostname'
            },
            headers: {
                'intuit-signature': 'intuit-signature-invalid'
            }
        };
        // Hapi response toolkit
        h = {
            response: function(msg) {
                return {
                    code: function(code) {
                        return { code, msg };
                    }
                };
            }
        };
    });

    describe('POST', async function() {

        // Not sent by Quickbooks. Simulates a bad actor.
        it('should return empty object when invalid or no payload', async function() {

            req.payload = undefined;
            const res = await webhookHandler(context, req, h);
            assert.deepEqual(res, { code: 200, msg: undefined });
        });

        // When there is no webhook verifier configured in the Backoffice.
        it('should fail when no webhook verifier configured in BO', async function() {

            req.payload = {
                eventNotifications: [{
                    realmId: REALM_ID_AIRBUS,
                    dataChangeEvent: {
                        entities: [CUSTOMER_A_CREATED, CUSTOMER_B_CREATED]
                    }
                }]
            };
            context.config.webhookVerifierToken = undefined;
            const res = await webhookHandler(context, req, h);
            assert.equal(res.code, 403);
            assert.equal(res.msg, 'No Verifier Token found');
        });

        it('should fail when payload not verified', async function() {

            req.payload = {
                eventNotifications: [{
                    realmId: REALM_ID_AIRBUS,
                    dataChangeEvent: {
                        entities: [CUSTOMER_A_CREATED, CUSTOMER_B_CREATED]
                    }
                }]
            };
            const res = await webhookHandler(context, req, h);
            assert.equal(res.code, 403);
            assert.equal(res.msg, 'Forbidden: Invalid signature');
        });

        // Single company, single entity: one triggerListeners call filtered by realmId.
        it('should trigger listeners for a single company and entity', async function() {

            req.payload = {
                eventNotifications: [{
                    realmId: REALM_ID_AIRBUS,
                    dataChangeEvent: {
                        entities: [INVOICE_B2_CREATED]
                    }
                }]
            };
            // Set the correct signature
            req.headers['intuit-signature'] = crypto.createHmac('sha256', context.config.webhookVerifierToken).update(JSON.stringify(req.payload)).digest('base64');

            const res = await webhookHandler(context, req, h);
            assert.equal(context.triggerComponent.callCount, 0);
            assert.equal(context.triggerListeners.callCount, 1);
            const callArg = context.triggerListeners.args[0][0];
            assert.equal(callArg.eventName, 'Invoice.Create');
            assert.deepEqual(callArg.payload, [INVOICE_B2_CREATED.id]);
            // The filter routes only to listeners registered for this realmId.
            assert.equal(callArg.filter({ params: { realmId: REALM_ID_AIRBUS } }), true);
            assert.equal(callArg.filter({ params: { realmId: REALM_ID_BOEING } }), false);
            assert.deepEqual(res, { code: 200, msg: undefined });
        });

        // Intuit issues separate verifier tokens for the Development (sandbox) and Production
        // webhook sections; both environments may point at the same endpoint.
        it('should accept a signature made with the sandbox verifier token', async function() {

            context.config.webhookVerifierTokenSandbox = 'sandboxVerifier';
            req.payload = {
                eventNotifications: [{
                    realmId: REALM_ID_AIRBUS,
                    dataChangeEvent: {
                        entities: [CUSTOMER_A_CREATED]
                    }
                }]
            };
            req.headers['intuit-signature'] = crypto.createHmac('sha256', 'sandboxVerifier').update(JSON.stringify(req.payload)).digest('base64');

            const res = await webhookHandler(context, req, h);
            assert.equal(context.triggerListeners.callCount, 1);
            assert.deepEqual(res, { code: 200, msg: undefined });
        });

        it('should accept a signature made with any of the comma-separated verifier tokens', async function() {

            context.config.webhookVerifierToken = 'prodVerifier, otherVerifier';
            req.payload = {
                eventNotifications: [{
                    realmId: REALM_ID_AIRBUS,
                    dataChangeEvent: {
                        entities: [CUSTOMER_A_CREATED]
                    }
                }]
            };
            req.headers['intuit-signature'] = crypto.createHmac('sha256', 'otherVerifier').update(JSON.stringify(req.payload)).digest('base64');

            const res = await webhookHandler(context, req, h);
            assert.equal(context.triggerListeners.callCount, 1);
            assert.deepEqual(res, { code: 200, msg: undefined });
        });

        // A trigger type with no events for a realm should not produce a triggerListeners call.
        it('should not trigger listeners when there are no matching events', async function() {

            req.payload = {
                eventNotifications: [{
                    realmId: REALM_ID_AIRBUS,
                    dataChangeEvent: {
                        entities: [CUSTOMER_A_CREATED]
                    }
                }]
            };
            // Set the correct signature
            req.headers['intuit-signature'] = crypto.createHmac('sha256', context.config.webhookVerifierToken).update(JSON.stringify(req.payload)).digest('base64');

            const res = await webhookHandler(context, req, h);
            // Exactly one call: Customer.Create for Airbus. Nothing for Invoice/Update.
            assert.equal(context.triggerListeners.callCount, 1);
            const callArg = context.triggerListeners.args[0][0];
            assert.equal(callArg.eventName, 'Customer.Create');
            assert.deepEqual(callArg.payload, [CUSTOMER_A_CREATED.id]);
            assert.deepEqual(res, { code: 200, msg: undefined });
        });

        // A big payload with multiple companies and entities. Quickbooks usually sends one company at a time with one entity.
        it('should trigger listeners per realm and trigger type for multiple companies', async function() {

            req.payload = {
                eventNotifications: [{
                    realmId: REALM_ID_AIRBUS,
                    dataChangeEvent: {
                        entities: [
                            CUSTOMER_A_CREATED, CUSTOMER_B_CREATED,
                            CUSTOMER_E_UPDATED,
                            INVOICE_A1_CREATED, INVOICE_A2_CREATED
                        ]
                    }
                }, {
                    realmId: REALM_ID_BOEING,
                    dataChangeEvent: {
                        entities: [
                            CUSTOMER_C_CREATED, CUSTOMER_D_CREATED,
                            // Only one invoice for Boeing
                            INVOICE_B1_CREATED
                        ]
                    }
                }]
            };
            // Set the correct signature
            req.headers['intuit-signature'] = crypto.createHmac('sha256', context.config.webhookVerifierToken).update(JSON.stringify(req.payload)).digest('base64');

            const res = await webhookHandler(context, req, h);
            assert.equal(context.triggerComponent.callCount, 0);
            // 5 calls: Airbus (Customer.Create, Customer.Update, Invoice.Create) +
            // Boeing (Customer.Create, Invoice.Create). Boeing has no Customer.Update events.
            assert.equal(context.triggerListeners.callCount, 5);

            // Each expected call: eventName, payload and the realmId its filter should match.
            const expectedCalls = [
                { eventName: 'Customer.Create', payload: [CUSTOMER_A_CREATED.id, CUSTOMER_B_CREATED.id], realmId: REALM_ID_AIRBUS },
                { eventName: 'Customer.Update', payload: [CUSTOMER_E_UPDATED.id], realmId: REALM_ID_AIRBUS },
                { eventName: 'Invoice.Create', payload: [INVOICE_A1_CREATED.id, INVOICE_A2_CREATED.id], realmId: REALM_ID_AIRBUS },
                { eventName: 'Customer.Create', payload: [CUSTOMER_C_CREATED.id, CUSTOMER_D_CREATED.id], realmId: REALM_ID_BOEING },
                { eventName: 'Invoice.Create', payload: [INVOICE_B1_CREATED.id], realmId: REALM_ID_BOEING }
            ];

            const actualCalls = context.triggerListeners.args.map(args => args[0]);
            for (const expected of expectedCalls) {
                const match = actualCalls.find(call =>
                    call.eventName === expected.eventName &&
                    JSON.stringify(call.payload) === JSON.stringify(expected.payload) &&
                    call.filter({ params: { realmId: expected.realmId } }) === true
                );
                assert(match, `Expected a triggerListeners call for ${expected.eventName} realm ${expected.realmId}`);
                // The filter must not match a different realm.
                const otherRealm = expected.realmId === REALM_ID_AIRBUS ? REALM_ID_BOEING : REALM_ID_AIRBUS;
                assert.equal(match.filter({ params: { realmId: otherRealm } }), false);
            }

            assert.deepEqual(res, { code: 200, msg: undefined });
        });
    });
});

describe('NewCustomer component', function() {

    const { receive } = require('../../accounting/NewCustomer/NewCustomer');
    let context;

    const QUICKBOOKS_CONTACT_A = { Id: '1', Active: true, FullyQualifiedName: 'Andy' };

    beforeEach(function() {

        context = {
            ...testUtils.createMockContext(),
            profileInfo: {
                companyId: 'companyId'
            }
        };
    });

    it('should send a single entity', async function() {

        // QuickBooks response
        const expectedQuickBooksContactsReposnse = {
            data: {
            	QueryResponse: {
                	Customer: [QUICKBOOKS_CONTACT_A]
            	}
            }
        };
        context.httpRequest = sinon.stub().resolves(expectedQuickBooksContactsReposnse);

        const payload = [CUSTOMER_A_CREATED.id, CUSTOMER_B_CREATED.id];
        context.messages = { webhook: { content: { data: payload } } };
        const res = await receive(context);

        assert.equal(res, undefined, 'response should be undefined');
        assert.equal(context.sendArray.callCount, 1);
        assert(context.lock.calledOnce);
        assert(context.lock().unlock.calledOnce);
        // Check HTTP call to Xero
        assert(context.httpRequest.calledOnce);
        const args = context.httpRequest.args[0];
        assert.equal(args[0].method, 'GET');
        assert.match(args[0].url, /v3\/company\/companyId\/query\?query=select/);
        assert.match(args[0].url, /Customer/);
        assert.match(args[0].url, /Id%20in%20\('1'%2C'2'\)/);

        const expectedoutput = [QUICKBOOKS_CONTACT_A];
        const sendArrayArgs = context.sendArray.args[0];
        assert.deepEqual(sendArrayArgs[0], expectedoutput);
    });

    it('should send multiple entities', async function() {

        // 100 entities
        const events = {
            eventNotifications: [{
                realmId: REALM_ID_AIRBUS,
                dataChangeEvent: {
                    entities: Array.from({ length: 100 }, (_, i) => ({
                        id: i + 1,
                        name: 'Customer',
                        operation: 'Create'
                    }))
                }
            }]
        };

        // QuickBooks responses
        // Expecting 3 calls to QuickBooks with 40, 40 and 20 IDs
        context.httpRequest = sinon.stub()
            .onCall(0).resolves(
                { QueryResponse: { Customer: events.eventNotifications[0].dataChangeEvent.entities.slice(0, 40) } })
            .onCall(1).resolves(
                { QueryResponse: { Customer: events.eventNotifications[0].dataChangeEvent.entities.slice(40, 80) } })
            .onCall(2).resolves(
                { QueryResponse: { Customer: events.eventNotifications[0].dataChangeEvent.entities.slice(80) } });

        const payload = events.eventNotifications[0].dataChangeEvent.entities.map(e => e.id);
        context.messages = { webhook: { content: { data: payload } } };
        const res = await receive(context);

        assert.equal(res, undefined, 'response should be undefined');
        assert.equal(context.sendArray.callCount, 3);
        assert(context.lock.calledOnce);
        assert(context.lock().unlock.calledOnce);

        // Check HTTP calls to QuickBooks with IDs in "IN" clause
        assert.equal(context.httpRequest.callCount, 3);
        // Check the first call
        const args1 = context.httpRequest.args[0];
        assert.equal(args1[0].method, 'GET');
        assert.match(args1[0].url, /v3\/company\/companyId\/query\?query=select/);
        assert.match(args1[0].url, /Customer/);
        assert.match(args1[0].url, /Id%20in%20\('1'%2C'2'/, 'First call should contain the first 40 IDs - start');
        assert.match(args1[0].url, /'39'%2C'40'\)/, 'First call should contain the first 40 IDs - end');

        // Check the second call
        const args2 = context.httpRequest.args[1];
        assert.equal(args2[0].method, 'GET');
        assert.match(args2[0].url, /v3\/company\/companyId\/query\?query=select/);
        assert.match(args2[0].url, /Customer/);
        assert.match(args2[0].url, /Id%20in%20\('41'%2C'42'/, 'Second call should contain the next 40 IDs - start');
        assert.match(args2[0].url, /'79'%2C'80'\)/, 'Second call should contain the next 40 IDs - end');

        // Check the third call
        const args3 = context.httpRequest.args[2];
        assert.equal(args3[0].method, 'GET');
        assert.match(args3[0].url, /v3\/company\/companyId\/query\?query=select/);
        assert.match(args3[0].url, /Customer/);
        assert.match(args3[0].url, /Id%20in%20\('81'%2C'82'/, 'Third call should contain the last 20 IDs - start');
        assert.match(args3[0].url, /'99'%2C'100'\)/, 'Third call should contain the last 20 IDs - end');
    });
});

describe('Quickbooks webhooks: realm grouping', function() {

    let context;
    let req;
    let h;

    function sign() {
        req.headers['intuit-signature'] = crypto.createHmac('sha256', context.config.webhookVerifierToken)
            .update(JSON.stringify(req.payload)).digest('base64');
    }

    beforeEach(function() {

        context = {
            ...testUtils.createMockContext(),
            config: { webhookVerifierToken: 'webhooksVerifier' },
            profileInfo: { companyId: 'companyId' }
        };
        req = { payload: {}, query: {}, info: { hostname: 'hostname' }, headers: {} };
        h = {
            response: function(msg) {
                return { code: function(code) { return { code, msg }; } };
            }
        };
    });

    // Intuit usually sends one notification per realm, but nothing guarantees it. Two
    // notifications for the same realm must be merged, not processed twice.
    it('should merge multiple notifications for the same realm', async function() {

        req.payload = {
            eventNotifications: [{
                realmId: REALM_ID_AIRBUS,
                dataChangeEvent: { entities: [CUSTOMER_A_CREATED] }
            }, {
                realmId: REALM_ID_AIRBUS,
                dataChangeEvent: { entities: [CUSTOMER_B_CREATED, INVOICE_A1_CREATED] }
            }]
        };
        sign();

        const res = await webhookHandler(context, req, h);
        // One call per trigger type, not per notification.
        assert.equal(context.triggerListeners.callCount, 2);
        const calls = context.triggerListeners.args.map(args => args[0]);

        const customerCall = calls.find(call => call.eventName === 'Customer.Create');
        assert(customerCall, 'Expected a Customer.Create call');
        // Entities from both notifications, none dropped.
        assert.deepEqual(customerCall.payload, [CUSTOMER_A_CREATED.id, CUSTOMER_B_CREATED.id]);

        const invoiceCall = calls.find(call => call.eventName === 'Invoice.Create');
        assert(invoiceCall, 'Expected an Invoice.Create call');
        assert.deepEqual(invoiceCall.payload, [INVOICE_A1_CREATED.id]);

        assert.deepEqual(res, { code: 200, msg: undefined });
    });

    // A trigger type present for one realm must not produce an empty call for another realm.
    it('should not cross trigger types between realms', async function() {

        req.payload = {
            eventNotifications: [{
                realmId: REALM_ID_AIRBUS,
                dataChangeEvent: { entities: [CUSTOMER_A_CREATED] }
            }, {
                realmId: REALM_ID_BOEING,
                dataChangeEvent: { entities: [INVOICE_B1_CREATED] }
            }]
        };
        sign();

        await webhookHandler(context, req, h);
        assert.equal(context.triggerListeners.callCount, 2);
        for (const call of context.triggerListeners.args.map(args => args[0])) {
            assert(call.payload.length, `Call for ${call.eventName} must not have an empty payload`);
        }
    });

    // Only the first notification is validated by isPayloadValid, so a later malformed one
    // must not crash the handler and lose the valid events.
    it('should tolerate a notification without dataChangeEvent', async function() {

        req.payload = {
            eventNotifications: [{
                realmId: REALM_ID_AIRBUS,
                dataChangeEvent: { entities: [CUSTOMER_A_CREATED] }
            }, {
                realmId: REALM_ID_BOEING
            }]
        };
        sign();

        const res = await webhookHandler(context, req, h);
        assert.equal(context.triggerListeners.callCount, 1);
        assert.equal(context.triggerListeners.args[0][0].eventName, 'Customer.Create');
        assert.deepEqual(res, { code: 200, msg: undefined });
    });

    // Intuit sends realmId as a string, but a listener may have stored it as a number.
    it('should match listeners whose realmId is a number', async function() {

        req.payload = {
            eventNotifications: [{
                realmId: Number(REALM_ID_AIRBUS),
                dataChangeEvent: { entities: [CUSTOMER_A_CREATED] }
            }]
        };
        sign();

        await webhookHandler(context, req, h);
        const call = context.triggerListeners.args[0][0];
        // onListenerAdded normalizes params.realmId to a string, so the filter compares strings.
        assert.equal(call.filter({ params: { realmId: REALM_ID_AIRBUS } }), true);
        assert.equal(call.filter({ params: { realmId: REALM_ID_BOEING } }), false);
    });
});

describe('Quickbooks onListenerAdded', function() {

    let onListenerAdded;

    beforeEach(async function() {

        const context = {
            ...testUtils.createMockContext(),
            http: { router: { register: sinon.stub() } }
        };
        await require('../../routes')(context);
        onListenerAdded = context.onListenerAdded.args[0][0];
    });

    it('should normalize realmId to a string', async function() {

        const listener = { params: { realmId: 1185883450 } };
        await onListenerAdded(listener);
        assert.deepEqual(listener.params, { realmId: '1185883450' });
    });

    it('should drop extra params', async function() {

        const listener = { params: { realmId: REALM_ID_AIRBUS, somethingElse: 'x' } };
        await onListenerAdded(listener);
        assert.deepEqual(listener.params, { realmId: REALM_ID_AIRBUS });
    });

    it('should reject a listener without realmId', async function() {

        await assert.rejects(() => onListenerAdded({ params: {} }), /Missing realmId/);
        await assert.rejects(() => onListenerAdded({}), /Missing realmId/);
    });
});

describe('Quickbooks trigger registration', function() {

    const TRIGGERS = [
        { path: '../../accounting/NewInvoice/NewInvoice', eventName: 'Invoice.Create' },
        { path: '../../accounting/UpdatedInvoice/UpdatedInvoice', eventName: 'Invoice.Update' },
        { path: '../../accounting/NewCustomer/NewCustomer', eventName: 'Customer.Create' },
        { path: '../../accounting/UpdatedCustomer/UpdatedCustomer', eventName: 'Customer.Update' }
    ];

    for (const trigger of TRIGGERS) {
        it(`${trigger.eventName} should register and unregister a listener`, async function() {

            const { start, stop } = require(trigger.path);
            const context = {
                ...testUtils.createMockContext(),
                profileInfo: { companyId: REALM_ID_AIRBUS }
            };

            await start(context);
            assert(context.addListener.calledOnce);
            assert.deepEqual(context.addListener.args[0], [trigger.eventName, { realmId: REALM_ID_AIRBUS }]);
            // The state-based registration must be gone — it is not AuthHub-compatible.
            assert.equal(context.service.stateAddToSet.callCount, 0);

            await stop(context);
            assert(context.removeListener.calledOnce);
            assert.deepEqual(context.removeListener.args[0], [trigger.eventName]);
        });
    }
});

const { webhookHandler } = require('../../src/appmixer/quickbooks/routes');
const assert = require('assert');
const sinon = require('sinon');
const crypto = require('crypto');
const testUtils = require('../utils.js');

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

    let context; let req; let h;

    beforeEach(function() {

        context = {
            ...testUtils.createMockContext(),
            componentId: 'componentId',
            flowId: 'flowId',
            service: {
                stateAddToSet: sinon.stub(),
                stateGet: sinon.stub()
            },
            config: {
                webhookVerifierToken: 'webhooksVerifier'
            },
            profileInfo: {
                companyId: 'companyId'
            },
            response: sinon.spy()
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
            context.service.stateGet = async function() {
                return [{ flowId: 'flowId', componentId: 'componentId' }];
            };
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

        it('should return empty object when no registered components', async function() {

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
            assert.deepEqual(res, { code: 200, msg: undefined });
        });

        // Single company, single entity, single component.
        it('should trigger a single component for a single company and entity', async function() {

            req.payload = {
                eventNotifications: [{
                    realmId: REALM_ID_AIRBUS,
                    dataChangeEvent: {
                        entities: [INVOICE_B2_CREATED]
                    }
                }]
            };
            context.service.stateGet.returns([{ flowId: 'flow-foo', componentId: 'component-bar' }]);
            // Set the correct signature
            req.headers['intuit-signature'] = crypto.createHmac('sha256', context.config.webhookVerifierToken).update(JSON.stringify(req.payload)).digest('base64');

            const res = await webhookHandler(context, req, h);
            assert.equal(context.service.stateGet.callCount, 1);
            assert.equal(context.triggerComponent.callCount, 1);
            assert(context.triggerComponent.calledWith('flow-foo', 'component-bar', [INVOICE_B2_CREATED.id]));
            assert.deepEqual(res, { code: 200, msg: undefined });
        });

        // Single company, single entity, no components.
        it('should not trigger any component for a single company and entity', async function() {

            req.payload = {
                eventNotifications: [{
                    realmId: REALM_ID_AIRBUS,
                    dataChangeEvent: {
                        entities: [CUSTOMER_A_CREATED]
                    }
                }]
            };
            context.service.stateGet.returns([]); // There is no `NewCustomer` component registered for Airbus company.
            // Set the correct signature
            req.headers['intuit-signature'] = crypto.createHmac('sha256', context.config.webhookVerifierToken).update(JSON.stringify(req.payload)).digest('base64');

            const res = await webhookHandler(context, req, h);
            assert.equal(context.service.stateGet.callCount, 1);
            assert.equal(context.triggerComponent.callCount, 0);
            assert.deepEqual(res, { code: 200, msg: undefined });
        });

        // A big payload with multiple companies and entities. Quickbooks usually sends one company at a time with one entity.
        it('should trigger multiple components in multiple flows for multiple companies', async function() {

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
            // Simulate 2 NewCustomer trigger components for Airbus
            context.service.stateGet.onCall(0).returns([
                { flowId: 'flowA', componentId: 'new-customer-comp-1' },
                { flowId: 'flowA', componentId: 'new-customer-comp-2' }
            ]);
            // Simulate 0 UpdateContact trigger component for Airbus
            context.service.stateGet.onCall(1).returns([]);
            // Simulate 2 NewInvoice trigger components for Airbus
            context.service.stateGet.onCall(2).returns([
                { flowId: 'flowA', componentId: 'new-invoice-comp-1' },
                { flowId: 'flowA', componentId: 'new-invoice-comp-2' }
            ]);
            // Simulate 2 NewCustomer trigger components for Boeing
            context.service.stateGet.onCall(3).returns([
                { flowId: 'flowB', componentId: 'new-customer-comp-3' },
                { flowId: 'flowB', componentId: 'new-customer-comp-4' }
            ]);
            // Simulate 0 UpdateContact trigger component for Boeing
            context.service.stateGet.onCall(4).returns([]);
            // Simulate 2 NewInvoice trigger components for Boeing
            context.service.stateGet.onCall(5).returns([
                { flowId: 'flowB', componentId: 'new-invoice-comp-3' },
                { flowId: 'flowB', componentId: 'new-invoice-comp-4' }
            ]);
            // Set the correct signature
            req.headers['intuit-signature'] = crypto.createHmac('sha256', context.config.webhookVerifierToken).update(JSON.stringify(req.payload)).digest('base64');

            const res = await webhookHandler(context, req, h);
            // 4 stateGet calls: 2 tenants * 3 component types
            assert.equal(context.service.stateGet.callCount, 6);
            // 4 NewCustomer components in total: 4 different new-contact-comp-x components
            // 0 UpdateCustomer: no components for this event type
            // 4 NewInvoice components in total: 4 different new-invoice-comp-x components
            assert.equal(context.triggerComponent.callCount, 8);
            // 8 expected calls
            const expectedCalls = [
                // Customers
                ['flowA', 'new-customer-comp-1', [CUSTOMER_A_CREATED.id, CUSTOMER_B_CREATED.id]],
                ['flowA', 'new-customer-comp-2', [CUSTOMER_A_CREATED.id, CUSTOMER_B_CREATED.id]],
                ['flowB', 'new-customer-comp-3', [CUSTOMER_C_CREATED.id, CUSTOMER_D_CREATED.id]],
                ['flowB', 'new-customer-comp-4', [CUSTOMER_C_CREATED.id, CUSTOMER_D_CREATED.id]],
                // Invoices
                ['flowA', 'new-invoice-comp-1', [INVOICE_A1_CREATED.id, INVOICE_A2_CREATED.id]],
                ['flowA', 'new-invoice-comp-2', [INVOICE_A1_CREATED.id, INVOICE_A2_CREATED.id]],
                ['flowB', 'new-invoice-comp-3', [INVOICE_B1_CREATED.id]],
                ['flowB', 'new-invoice-comp-4', [INVOICE_B1_CREATED.id]]
            ];
            // Loose comparison of the calls
            for (const expectedCall of expectedCalls) {
                assert(context.triggerComponent.calledWith(...expectedCall));
            }

            assert.deepEqual(res, { code: 200, msg: undefined });
        });
    });
});

describe('NewCustomer component', function() {

    const { receive } = require('../../src/appmixer/quickbooks/accounting/NewCustomer/NewCustomer');
    let context;

    const QUICKBOOKS_CONTACT_A = { Id: '1', Active: true, FullyQualifiedName: 'Andy' };

    beforeEach(function() {

        context = {
            ...testUtils.createMockContext(),
            componentId: 'componentId',
            flowId: 'flowId',
            service: {
                stateAddToSet: sinon.stub(),
                stateGet: sinon.stub()
            },
            config: {
                webhookVerifierToken: 'webhooksVerifier'
            },
            profileInfo: {
                companyId: 'companyId'
            },
            httpRequest: sinon.stub(),
            sendArray: sinon.spy(),
            response: sinon.spy()
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

        // Xero responses
        // Expecting 3 calls to Xero with 40, 40 and 20 IDs
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

        // Check HTTP calls to Quickbooks with IDs in "IN" clause
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

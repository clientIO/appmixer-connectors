const routes = require('../../src/appmixer/xero/routes');
const assert = require('assert');
const sinon = require('sinon');
const crypto = require('crypto');
const testUtils = require('../utils.js');
const XeroClient = require('../../src/appmixer/xero/XeroClient');

// Fixtures
const NOW = new Date().toISOString().slice(0, 19);
const TENANT_ID_AIRBUS = 'a2cc9b6e-9458-4c7d-93cc-f02b81b0594f';
const TENANT_ID_BOEING = 'b2cc9b6e-9458-4c7d-93cc-f02b81b0594f';
const CONTACT_A_CREATED = {
    resourceUrl: 'https://api.xero.com/api.xro/2.0/Contacts/airbus-andy',
    resourceId: 'airbus-andy',
    eventDateUtc: NOW,
    eventType: 'CREATE',
    eventCategory: 'CONTACT',
    tenantId: TENANT_ID_AIRBUS,
    tenantType: 'ORGANISATION'
};
const CONTACT_B_CREATED = { ...CONTACT_A_CREATED, resourceId: 'airbus-bob', resourceUrl: 'https://api.xero.com/api.xro/2.0/Contacts/airbus-bob' };
const CONTACT_C_CREATED = { ...CONTACT_A_CREATED, resourceId: 'boeing-carl', tenantId: TENANT_ID_BOEING, resourceUrl: 'https://api.xero.com/api.xro/2.0/Contacts/boeing-carl' };
const CONTACT_D_CREATED = { ...CONTACT_A_CREATED, resourceId: 'boeing-dave', tenantId: TENANT_ID_BOEING, resourceUrl: 'https://api.xero.com/api.xro/2.0/Contacts/boeing-dave' };
const CONTACT_E_UPDATED = { ...CONTACT_A_CREATED, eventType: 'UPDATE', resourceId: 'airbus-eddy', resourceUrl: 'https://api.xero.com/api.xro/2.0/Contacts/airbus-eddy' };
const INVOICE_A1_CREATED = {
    resourceUrl: 'https://api.xero.com/api.xro/2.0/Invoices/a-0000000001',
    resourceId: 'a-0000000001',
    eventDateUtc: NOW,
    eventType: 'CREATE',
    eventCategory: 'INVOICE',
    tenantId: TENANT_ID_AIRBUS,
    tenantType: 'ORGANISATION'
};
const INVOICE_A2_CREATED = { ...INVOICE_A1_CREATED, resourceId: 'a-0000000002', resourceUrl: 'https://api.xero.com/api.xro/2.0/Invoices/a-0000000002' };
const INVOICE_B1_CREATED = { ...INVOICE_A1_CREATED, resourceId: 'b-2412323441', tenantId: TENANT_ID_BOEING, resourceUrl: 'https://api.xero.com/api.xro/2.0/Invoices/b-2412323441' };
const INVOICE_B2_CREATED = { ...INVOICE_A1_CREATED, resourceId: 'b-2412323442', tenantId: TENANT_ID_BOEING, resourceUrl: 'https://api.xero.com/api.xro/2.0/Invoices/b-2412323442' };

const webhookHandler = routes.webhookHandler;

describe('Xero webhooks', function() {

    let context = testUtils.createMockContext();
    let req; let h;

    beforeEach(async function() {

        context = {
            ...testUtils.createMockContext(),
            // Routes/plugins specific stubs
            http: {
                router: {
                    register: sinon.stub()
                }
            },
            config: {
                webhookKey: 'webhookKey'
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
                'x-xero-signature': 'xero-signature-invalid'
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

        // Not sent by Xero. Simulates a bad actor.
        it('should return empty object when no payload and no registered components and ', async function() {

            req.payload = undefined;
            const res = await webhookHandler(context, req, h);
            assert.deepEqual(res, { code: 200, msg: undefined });
        });

        // Not sent by Xero. Simulates a bad actor.
        it('should return empty object when no payload and some registered components', async function() {

            req.payload = undefined;
            const res = await webhookHandler(context, req, h);
            assert.deepEqual(res, { code: 200, msg: undefined });
        });

        // When there is no webhook verifier configured in the Backoffice.
        it('should fail when payload not verified', async function() {

            req.payload = stringifyXeroWebhookPayload({
                events: [CONTACT_A_CREATED],
                lastEventSequence: 1,
                firstEventSequence: 1,
                entropy: 'S0m3r4Nd0mt3xt'
            });
            const res = await webhookHandler(context, req, h);
            assert.equal(res.code, 401);
            assert.equal(res.msg, undefined);
        });

        // Single entity, single component.
        it('should trigger a single component for a single entity', async function() {

            req.payload = stringifyXeroWebhookPayload({
                events: [INVOICE_B2_CREATED],
                lastEventSequence: 1,
                firstEventSequence: 1,
                entropy: 'S0m3r4Nd0mt3xt'
            });
            // Set the correct signature
            req.headers['x-xero-signature'] = crypto.createHmac('sha256', context.config.webhookKey).update(req.payload).digest('base64');

            const res = await webhookHandler(context, req, h);
            assert.equal(context.triggerComponent.callCount, 0);
            assert.equal(context.triggerListeners.callCount, 1);
            assert(context.triggerListeners.calledWith({
                eventName: `INVOICE.CREATE:${INVOICE_B2_CREATED.tenantId}`,
                payload: [INVOICE_B2_CREATED.resourceId]
            }));
            assert.deepEqual(res, { code: 200, msg: undefined });
        });

        // A larger payload with multiple companies and entities.
        it('should trigger multiple components in multiple flows for multiple companies', async function() {

            req.payload = stringifyXeroWebhookPayload({
                events: [
                    // Contacts
                    CONTACT_A_CREATED, CONTACT_B_CREATED, CONTACT_C_CREATED, CONTACT_D_CREATED,
                    CONTACT_E_UPDATED,
                    // Invoices
                    INVOICE_A1_CREATED, INVOICE_A2_CREATED, INVOICE_B1_CREATED
                ],
                lastEventSequence: 7,
                firstEventSequence: 1,
                entropy: 'S0m3r4Nd0mt3xt'
            });

            // Set the correct signature
            req.headers['x-xero-signature'] = crypto.createHmac('sha256', context.config.webhookKey).update(req.payload).digest('base64');

            const res = await webhookHandler(context, req, h);
            assert.equal(context.triggerComponent.callCount, 0);
            assert.equal(context.triggerListeners.callCount, 5);
            // 5 expected calls
            const expectedCalls = [
                // Contacts
                {
                    eventName: `CONTACT.CREATE:${CONTACT_A_CREATED.tenantId}`,
                    payload: [CONTACT_A_CREATED.resourceId, CONTACT_B_CREATED.resourceId]
                },
                {
                    eventName: `CONTACT.CREATE:${CONTACT_C_CREATED.tenantId}`,
                    payload: [CONTACT_C_CREATED.resourceId, CONTACT_D_CREATED.resourceId]
                },
                {
                    eventName: `CONTACT.UPDATE:${CONTACT_A_CREATED.tenantId}`,
                    payload: [CONTACT_E_UPDATED.resourceId]
                },
                // Invoices
                {
                    eventName: `INVOICE.CREATE:${INVOICE_A1_CREATED.tenantId}`,
                    payload: [INVOICE_A1_CREATED.resourceId, INVOICE_A2_CREATED.resourceId]
                },
                {
                    eventName: `INVOICE.CREATE:${INVOICE_B1_CREATED.tenantId}`,
                    payload: [INVOICE_B1_CREATED.resourceId]
                }
            ];
            // Loose comparison of the calls
            for (const expectedCall of expectedCalls) {
                assert(context.triggerListeners.calledWith({
                    eventName:expectedCall.eventName,
                    payload:expectedCall.payload
                }));
            }

            assert.deepEqual(res, { code: 200, msg: undefined });
        });
    });
});

describe('NewContact component', function() {

    const { receive } = require('../../src/appmixer/xero/accounting/NewContact/NewContact');
    let context;

    const XERO_CONTACT_A = { ContactID: 'airbus-andy', ContactStatus: 'ACTIVE', Name: 'Andy' };

    beforeEach(function() {

        context = {
            ...testUtils.createMockContext(),
            accessToken: 'accessToken',
            componentId: 'componentId',
            flowId: 'flowId',
            properties: {
                tenantId: 'tenantId-1'
            },
            httpRequest: {
                create: sinon.spy()
            },
            sendArray: sinon.spy(),
            response: sinon.spy()
        };
    });

    it('should send a single entity', async function() {

        // Xero response
        const expectedXeroContactsReposnse = [
            { ContactID: CONTACT_A_CREATED.resourceId, ContactStatus: 'ACTIVE', Name: 'Andy' }
            // { ContactID: CONTACT_B_CREATED.resourceId, ContactStatus: 'ACTIVE', Name: 'Bob' }
        ];
        XeroClient.prototype.request = sinon.stub().returns({ Contacts: expectedXeroContactsReposnse });

        const payload = [CONTACT_A_CREATED.resourceId, CONTACT_B_CREATED.resourceId];
        context.messages = { webhook: { content: { data: payload } } };
        const res = await receive(context);

        assert.equal(res, undefined, 'response should be undefined');
        assert.equal(context.sendArray.callCount, 1);
        assert(context.lock.calledOnce);
        assert(context.lock().unlock.calledOnce);
        // Check HTTP call to Xero
        assert(XeroClient.prototype.request.calledOnce);
        const args = XeroClient.prototype.request.args[0];
        assert.equal(args[0], 'GET');
        assert.equal(args[1], '/api.xro/2.0/Contacts');
        assert.deepEqual(args[2].params, { page: 1, IDs: payload.join(','), includeArchived: true, summaryOnly: false });

        const expectedoutput = [XERO_CONTACT_A];
        const sendArrayArgs = context.sendArray.args[0];
        assert.deepEqual(sendArrayArgs[0], expectedoutput);

        assert(context.response.calledOnce);
    });

    it('should send multiple entities', async function() {

        // 100 entities
        const events = Array.from({ length: 100 }, (_, i) => ({
            resourceId: `id-${i}`,
            tenantId: 'tenantId-1'
        }));

        // Xero response
        const expectedXeroContactsReposnse = events.map(e => ({
            ContactID: e.resourceId,
            ContactStatus: 'ACTIVE',
            Name: `Name-${e.resourceId}`
        }));
        // Expecting 3 calls to Xero with 40, 40 and 20 IDs
        XeroClient.prototype.request = sinon.stub()
            .onCall(0).returns({ Contacts: expectedXeroContactsReposnse.slice(0, 40) })
            .onCall(1).returns({ Contacts: expectedXeroContactsReposnse.slice(40, 80) })
            .onCall(2).returns({ Contacts: expectedXeroContactsReposnse.slice(80) });

        const payload = events.map(e => e.resourceId);
        context.messages = { webhook: { content: { data: payload } } };
        const res = await receive(context);

        assert.equal(res, undefined, 'response should be undefined');
        assert.equal(context.sendArray.callCount, 3);
        assert(context.lock.calledOnce);
        assert(context.lock().unlock.calledOnce);

        // Check HTTP calls to Xero with IDs=...
        assert.equal(XeroClient.prototype.request.callCount, 3);
        // Check the first call
        const args1 = XeroClient.prototype.request.args[0];
        assert.equal(args1[0], 'GET');
        assert.equal(args1[1], '/api.xro/2.0/Contacts');
        const expectedIDs1 = payload.slice(0, 40);
        assert.deepEqual(args1[2].params, { page: 1, IDs: expectedIDs1.join(','), includeArchived: true, summaryOnly: false });
        // Check the second call
        const args2 = XeroClient.prototype.request.args[1];
        assert.equal(args2[0], 'GET');
        assert.equal(args2[1], '/api.xro/2.0/Contacts');
        const expectedIDs2 = payload.slice(40, 80);
        assert.deepEqual(args2[2].params, { page: 1, IDs: expectedIDs2.join(','), includeArchived: true, summaryOnly: false });
        // Check the third call
        const args3 = XeroClient.prototype.request.args[2];
        assert.equal(args3[0], 'GET');
        assert.equal(args3[1], '/api.xro/2.0/Contacts');
        const expectedIDs3 = payload.slice(80);
        assert.deepEqual(args3[2].params, { page: 1, IDs: expectedIDs3.join(','), includeArchived: true, summaryOnly: false });

    });
});

/** Adding spaces. From ":" to ": " */
function stringifyXeroWebhookPayload(payload) {
    // eg: {"events":[{ "resourceId": "65a44264-dea0-481a-b49d-18a334a72334", "tenantId": "19603b24-fa8f-4cfa-955d-3ca56ba7f4ba" }]}
    return JSON.stringify(payload).replace(/":"/g, '": "');
}

const assert = require('assert');
const crypto = require('crypto');
const sinon = require('sinon');
const testUtils = require('../../../../../test/utils.js');
const routes = require('../../routes');

describe('ServiceNow plugin routes', () => {

    const INSTANCE = 'dev123';
    const WEBHOOK_SECRET = 'test-webhook-secret-0123456789';
    const SECRET_HASH = crypto.createHash('sha256').update(WEBHOOK_SECRET).digest('hex');
    const h = {
        response: body => ({ code: statusCode => ({ body, statusCode }) })
    };
    const payload = {
        type: `${INSTANCE}.incident.insert`,
        data: { sys_id: 'abc', number: 'INC0010001' }
    };

    let context;
    let handler;
    let onListenerAdded;

    beforeEach(async () => {

        context = {
            ...testUtils.createMockContext(),
            http: {
                router: {
                    register: sinon.stub()
                }
            }
        };

        await routes(context);
        handler = context.http.router.register.getCall(0).args[0].options.handler;
        onListenerAdded = context.onListenerAdded.getCall(0).args[0];
    });

    describe('POST /events', () => {

        const listener = params => ({ eventName: payload.type, params });

        it('triggers only listeners of the same instance and secret', async () => {

            const response = await handler({ headers: { 'x-appmixer-secret': WEBHOOK_SECRET }, payload }, h);

            assert.deepEqual(response, {});
            assert.equal(context.triggerListeners.callCount, 1);
            const { eventName, payload: data, filter } = context.triggerListeners.getCall(0).args[0];
            assert.equal(eventName, payload.type);
            assert.deepEqual(data, payload.data);

            assert.equal(filter(listener({ instance: INSTANCE, secretHash: SECRET_HASH })), true);
            assert.equal(filter(listener({ instance: 'other', secretHash: SECRET_HASH })), false);
            assert.equal(filter(listener({ instance: INSTANCE, secretHash: 'a'.repeat(64) })), false);
            assert.equal(filter(listener({ instance: INSTANCE })), false);
            assert.equal(filter(listener(undefined)), false);
        });

        it('does not match any listener with a wrong secret', async () => {

            await handler({ headers: { 'x-appmixer-secret': 'attacker' }, payload }, h);

            const { filter } = context.triggerListeners.getCall(0).args[0];
            assert.equal(filter(listener({ instance: INSTANCE, secretHash: SECRET_HASH })), false);
        });

        it('rejects a request without the secret header', async () => {

            const response = await handler({ headers: {}, payload }, h);

            assert.equal(response.statusCode, 401);
            assert.equal(context.triggerListeners.callCount, 0);
        });

        it('rejects a request without type', async () => {

            const response = await handler({ headers: { 'x-appmixer-secret': WEBHOOK_SECRET }, payload: {} }, h);

            assert.equal(response.statusCode, 400);
            assert.equal(context.triggerListeners.callCount, 0);
        });
    });

    describe('onListenerAdded', () => {

        it('accepts and normalizes a listener of the connection\'s instance', async () => {

            const params = { instance: INSTANCE, secretHash: SECRET_HASH, extra: 1 };
            const listener = { eventName: payload.type, params };
            await onListenerAdded(listener);

            assert.deepEqual(listener.params, { instance: INSTANCE, secretHash: SECRET_HASH });
        });

        it('rejects a listener without instance', async () => {

            await assert.rejects(onListenerAdded({ eventName: payload.type, params: { secretHash: SECRET_HASH } }));
        });

        it('rejects a listener with an invalid secretHash', async () => {

            const params = { instance: INSTANCE, secretHash: WEBHOOK_SECRET };
            await assert.rejects(onListenerAdded({ eventName: payload.type, params }));
        });

        it('rejects a listener whose event name belongs to another instance', async () => {

            const params = { instance: INSTANCE, secretHash: SECRET_HASH };
            await assert.rejects(onListenerAdded({ eventName: 'other.incident.insert', params }));
        });
    });
});

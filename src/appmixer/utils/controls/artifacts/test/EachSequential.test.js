'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { createMockContext } = require('../../../../../../test/utils');

const Each = require('../../Each/Each');
const ContinueEach = require('../../ContinueEach/ContinueEach');

const WEBHOOK_URL = 'https://api.appmixer.test/flows/flow-1/components/each-1' +
    '?correlationId=corr-1&correlationInPort=in&messageId=msg-1';

/**
 * A minimal stand-in for the engine around one sequential Each: the component state of Each, the
 * flow state (shared by Each and ContinueEach) and the webhook endpoint of Each are shared by every
 * receive() call, exactly like in a running flow.
 */
function createHarness() {

    const state = {};
    const flowState = {};
    const sent = [];
    const timeouts = [];
    const cleared = [];
    const triggered = [];

    // The engine's POST /flows/{flowId}/components/{componentId} - the webhook URL of Each.
    const callAppmixer = async ({ endPoint, method, body }) => {
        const url = new URL(endPoint, 'https://api.appmixer.test');
        const match = url.pathname.match(/^\/flows\/([^/]+)\/components\/([^/]+)$/);
        if (method !== 'POST' || !match) {
            throw new Error(`Unexpected call ${method} ${endPoint}`);
        }
        triggered.push({
            flowId: match[1],
            componentId: match[2],
            query: Object.fromEntries(url.searchParams),
            data: body
        });
        return { message: 'Enqueued.' };
    };

    const createContext = (messages, id = 'each-run-1') => {
        const context = createMockContext({ id, messages, properties: {} });
        context.flowId = 'flow-1';
        context.componentId = 'each-1';
        context.log = sinon.stub();
        context.getWebhookUrl = sinon.stub().returns(WEBHOOK_URL);
        context.callAppmixer = sinon.spy(callAppmixer);
        context.stateGet = sinon.spy(async key => state[key]);
        context.stateSet = sinon.spy(async (key, value) => { state[key] = value; });
        context.stateUnset = sinon.spy(async key => { delete state[key]; });
        context.flow = {
            stateGet: sinon.spy(async key => flowState[key]),
            stateSet: sinon.spy(async (key, value) => { flowState[key] = value; }),
            stateUnset: sinon.spy(async key => { delete flowState[key]; })
        };
        context.sendJson = sinon.spy(async (content, port) => { sent.push({ content, port }); });
        context.setTimeout = sinon.spy(async (content, ms) => {
            const timeoutId = `timeout-${timeouts.length}`;
            timeouts.push({ timeoutId, content, ms });
            return timeoutId;
        });
        context.clearTimeout = sinon.spy(async timeoutId => { cleared.push(timeoutId); });
        return context;
    };

    return {
        state, flowState, sent, timeouts, cleared, triggered,
        start: (content, id) => Each.receive(createContext({ in: { content } }, id)),
        // The webhook delivery runs in a NEW context (a different context.id), like in the engine.
        ack: (id, index, result) => Each.receive(
            createContext({ webhook: { content: { data: { id, index, result } } } }, 'webhook-ctx')),
        timeout: content => Each.receive(createContext({ timeout: { content } }, 'timeout-ctx')),
        // The loop body reached ContinueEach: it wakes Each up through the webhook endpoint above.
        continueEach: content => ContinueEach.receive(createContext({ in: { content } }, 'continue-ctx')),
        // Deliver what ContinueEach posted to the webhook endpoint, like the engine would.
        deliverLast: () => {
            const { data } = triggered[triggered.length - 1];
            return Each.receive(createContext({ webhook: { content: { data } } }, 'webhook-ctx'));
        },
        createContext,
        items: () => sent.filter(m => m.port === 'item').map(m => m.content),
        dones: () => sent.filter(m => m.port === 'done').map(m => m.content)
    };
}

describe('Each Component - sequential mode', () => {

    afterEach(() => {
        sinon.restore();
    });

    it('should emit only the first item and wait', async () => {
        const h = createHarness();

        await h.start({ list: ['a', 'b', 'c'], sequential: true });

        assert.deepStrictEqual(h.items(), [
            { index: 0, value: 'a', count: 3, correlationId: 'each-run-1' }
        ]);
        assert.strictEqual(h.dones().length, 0);

        // The list is parked in the component state, the cursor points at the item in flight.
        assert.deepStrictEqual(h.state['items:each-run-1'], ['a', 'b', 'c']);
        const { timeoutToken, ...cursor } = h.state['each-run-1'];
        assert.deepStrictEqual(cursor, {
            index: 0, timeoutId: 'timeout-0', count: 3, correlationId: 'each-run-1',
            delay: 0, itemTimeout: 300, results: []
        });
        assert.ok(typeof timeoutToken === 'string' && timeoutToken.length > 0);
        // ContinueEach finds the webhook target of the loop in the flow state. All three query
        // parameters are needed by the engine to restore the scope of the original message.
        assert.deepStrictEqual(h.flowState['each:each-run-1'], {
            componentId: 'each-1',
            webhookQuery: { correlationId: 'corr-1', correlationInPort: 'in', messageId: 'msg-1' }
        });

        // The timeout carries the token of this attempt.
        assert.deepStrictEqual(h.timeouts[0].content, { id: 'each-run-1', sequential: true, index: 0, timeoutToken });
        // Default item timeout: 300 s.
        assert.strictEqual(h.timeouts[0].ms, 300000);
        // No plugin involved.
        assert.strictEqual(h.triggered.length, 0);
    });

    it('should emit the next item on each acknowledgement and done after the last one', async () => {
        const h = createHarness();

        await h.start({ list: ['a', 'b', 'c'], sequential: true });
        await h.ack('each-run-1', 0);
        assert.deepStrictEqual(h.items().map(i => i.value), ['a', 'b']);
        assert.strictEqual(h.dones().length, 0);

        await h.ack('each-run-1', 1);
        assert.deepStrictEqual(h.items().map(i => i.value), ['a', 'b', 'c']);
        assert.strictEqual(h.dones().length, 0);

        await h.ack('each-run-1', 2);
        assert.deepStrictEqual(h.items().map(i => i.index), [0, 1, 2]);
        // One entry per item, even when ContinueEach adds no fields.
        assert.deepStrictEqual(h.dones(), [{ count: 3, correlationId: 'each-run-1', result: [{}, {}, {}] }]);

        // Every pending item timeout was cleared and nothing is left behind.
        assert.deepStrictEqual(h.cleared, ['timeout-0', 'timeout-1', 'timeout-2']);
        assert.deepStrictEqual(h.state, {});
        assert.deepStrictEqual(h.flowState, {});
    });

    it('should collect one entry per item from ContinueEach and emit them on done, in item order', async () => {
        const h = createHarness();

        await h.start({ list: ['a', 'b', 'c'], sequential: true });
        await h.ack('each-run-1', 0, { ts: 'ts-a' });
        // More than one field per item: still one entry.
        await h.ack('each-run-1', 1, { ts: 'ts-b', channel: 'C1' });
        // No fields for this item.
        await h.ack('each-run-1', 2, {});

        assert.deepStrictEqual(h.dones(), [{
            count: 3, correlationId: 'each-run-1', result: [{ ts: 'ts-a' }, { ts: 'ts-b', channel: 'C1' }, {}]
        }]);
    });

    it('should ignore a duplicated acknowledgement (fan-out into two ContinueEach, re-delivery)', async () => {
        const h = createHarness();

        await h.start({ list: ['a', 'b', 'c'], sequential: true });
        await h.ack('each-run-1', 0, { v: 'first' });
        await h.ack('each-run-1', 0, { v: 'again' });

        // Still exactly one item in flight: 'b'. A second 'c' would break the ordering guarantee.
        assert.deepStrictEqual(h.items().map(i => i.value), ['a', 'b']);
        assert.strictEqual(h.state['each-run-1'].index, 1);
        // And the duplicate did not add to the result.
        assert.deepStrictEqual(h.state['each-run-1'].results, [{ v: 'first' }]);
    });

    it('should move on when an item is not acknowledged in time, and ignore its late acknowledgement', async () => {
        const h = createHarness();

        await h.start({ list: ['a', 'b', 'c'], sequential: true, itemTimeout: 120 });
        assert.strictEqual(h.timeouts[0].ms, 120000);

        await h.timeout(h.timeouts[0].content);
        assert.deepStrictEqual(h.items().map(i => i.value), ['a', 'b']);

        // The slow branch of item 0 finally reaches ContinueEach - 'b' is in flight, nothing happens.
        await h.ack('each-run-1', 0, { v: 'late' });
        assert.deepStrictEqual(h.items().map(i => i.value), ['a', 'b']);

        // A stale timeout (item 0 again) is ignored too.
        await h.timeout(h.timeouts[0].content);
        assert.deepStrictEqual(h.items().map(i => i.value), ['a', 'b']);

        // A skipped item is null in the result, the late value is dropped.
        await h.ack('each-run-1', 1, { v: 'b' });
        await h.ack('each-run-1', 2, { v: 'c' });
        assert.deepStrictEqual(h.dones()[0].result, [null, { v: 'b' }, { v: 'c' }]);
    });

    it('should send done after the last item times out', async () => {
        const h = createHarness();

        await h.start({ list: ['a'], sequential: true });
        await h.timeout(h.timeouts[0].content);

        assert.deepStrictEqual(h.dones(), [{ count: 1, correlationId: 'each-run-1', result: [null] }]);
        assert.deepStrictEqual(h.state, {});
        assert.deepStrictEqual(h.flowState, {});
    });

    it('should send done right away for an empty list', async () => {
        const h = createHarness();

        await h.start({ list: [], sequential: true });

        assert.strictEqual(h.items().length, 0);
        assert.deepStrictEqual(h.dones(), [{ count: 0, correlationId: 'each-run-1', result: [] }]);
        assert.deepStrictEqual(h.state, {});
        assert.deepStrictEqual(h.flowState, {});
        assert.strictEqual(h.timeouts.length, 0);
    });

    it('should not restart a running loop when the engine re-delivers `in`', async () => {
        const h = createHarness();
        const content = { list: ['a', 'b', 'c'], sequential: true };

        await h.start(content);
        await h.ack('each-run-1', 0);
        // Same context.id => same loop.
        await h.start(content);

        assert.deepStrictEqual(h.items().map(i => i.value), ['a', 'b']);
        assert.strictEqual(h.state['each-run-1'].index, 1);
    });

    it('should keep concurrent loops of the same component apart', async () => {
        const h = createHarness();

        await h.start({ list: ['a1', 'a2'], sequential: true }, 'run-a');
        await h.start({ list: ['b1', 'b2'], sequential: true }, 'run-b');
        await h.ack('run-b', 0, { v: 'b1-done' });

        assert.deepStrictEqual(h.items().map(i => i.value), ['a1', 'b1', 'b2']);
        assert.strictEqual(h.state['run-a'].index, 0);
        assert.deepStrictEqual(h.state['run-a'].results, []);
        assert.strictEqual(h.state['run-b'].index, 1);
        assert.deepStrictEqual(h.state['run-b'].results, [{ v: 'b1-done' }]);
    });

    it('should ignore a malformed or unknown acknowledgement', async () => {
        const h = createHarness();

        await h.start({ list: ['a', 'b'], sequential: true });
        await h.ack(undefined, 0);
        await h.ack('each-run-1', 'not-a-number');
        await h.ack('each-run-1', -1);
        // Number() would turn all of these into 0.
        for (const bad of [null, false, [], '', '   ', true]) {
            await h.ack('each-run-1', bad);
        }
        await h.ack('unknown-run', 0);
        // A result that is not an object becomes an empty entry, the acknowledgement itself still counts.
        await h.ack('each-run-1', 0, ['not', 'an', 'object']);

        assert.deepStrictEqual(h.items().map(i => i.value), ['a', 'b']);
        assert.deepStrictEqual(h.state['each-run-1'].results, [{}]);
    });

    it('should accept a numeric string index', async () => {
        const h = createHarness();

        await h.start({ list: ['a', 'b'], sequential: true });
        await h.ack('each-run-1', ' 0 ');

        assert.deepStrictEqual(h.items().map(i => i.value), ['a', 'b']);
    });

    it('should ignore the orphaned timeout of a failed attempt when the item is retried', async () => {
        const h = createHarness();
        const context = h.createContext({ in: { content: { list: ['a', 'b'], sequential: true } } });
        // The first attempt sets its timeout, then sendJson fails; the engine retries the message.
        context.sendJson = sinon.stub().rejects(new Error('Broker unavailable'));
        await assert.rejects(async () => Each.receive(context), /Broker unavailable/);
        assert.strictEqual(h.timeouts.length, 1);

        await h.start({ list: ['a', 'b'], sequential: true });
        assert.deepStrictEqual(h.items().map(i => i.value), ['a']);
        assert.strictEqual(h.timeouts.length, 2);

        // The orphaned timeout of the first attempt refers to the same item, but not this attempt.
        await h.timeout(h.timeouts[0].content);
        assert.deepStrictEqual(h.items().map(i => i.value), ['a']);
        assert.strictEqual(h.state['each-run-1'].index, 0);

        // The timeout of the retried attempt does move the loop on.
        await h.timeout(h.timeouts[1].content);
        assert.deepStrictEqual(h.items().map(i => i.value), ['a', 'b']);
    });

    it('should still honour a timeout set before timeout tokens existed', async () => {
        const h = createHarness();

        await h.start({ list: ['a', 'b'], sequential: true });
        await h.timeout({ id: 'each-run-1', sequential: true, index: 0 });

        assert.deepStrictEqual(h.items().map(i => i.value), ['a', 'b']);
    });

    it('should record the acknowledgement before the delay, so a timeout during it keeps the values', async () => {
        const h = createHarness();

        await h.start({ list: ['a', 'b', 'c'], sequential: true, delay: 80 });
        const acking = h.ack('each-run-1', 0, { ts: 'ts-a' });
        // The ack is recorded under the lock right away...
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.strictEqual(h.state['each-run-1'].acked, true);
        assert.deepStrictEqual(h.state['each-run-1'].results, [{ ts: 'ts-a' }]);
        // ...a duplicate acknowledgement during the delay is ignored...
        await h.ack('each-run-1', 0, { ts: 'dup' });
        // ...and the item timeout firing during the delay moves on, keeping the value.
        await h.timeout(h.timeouts[0].content);
        assert.deepStrictEqual(h.items().map(i => i.value), ['a', 'b']);
        assert.deepStrictEqual(h.state['each-run-1'].results, [{ ts: 'ts-a' }]);
        assert.strictEqual(h.state['each-run-1'].acked, undefined);

        // The delayed acknowledgement finds the loop already moved on and does not emit 'c'.
        await acking;
        assert.deepStrictEqual(h.items().map(i => i.value), ['a', 'b']);

        await h.ack('each-run-1', 1, { ts: 'ts-b' });
        await h.ack('each-run-1', 2, { ts: 'ts-c' });
        assert.deepStrictEqual(h.dones()[0].result, [{ ts: 'ts-a' }, { ts: 'ts-b' }, { ts: 'ts-c' }]);
    });

    it('should reject an item timeout below one minute (the engine would silently round it up)', async () => {
        for (const bad of [10, -1, 'foo', NaN]) {
            const h = createHarness();
            const context = h.createContext({ in: { content: { list: ['a'], sequential: true, itemTimeout: bad } } });

            await assert.rejects(
                async () => Each.receive(context),
                err => err instanceof context.CancelError && err.message.includes('itemTimeout')
            );
            assert.strictEqual(h.items().length, 0);
        }
    });

    it('should apply the delay before each next item, but not before the first one or done', async () => {
        const h = createHarness();
        const delay = 60;
        const elapsed = async fn => {
            const startedAt = Date.now();
            await fn();
            return Date.now() - startedAt;
        };

        const startTook = await elapsed(() => h.start({ list: ['a', 'b'], sequential: true, delay }));
        assert.deepStrictEqual(h.items().map(i => i.value), ['a']);
        assert.ok(startTook < delay, `no delay before the first item, took ${startTook} ms`);

        const nextTook = await elapsed(() => h.ack('each-run-1', 0));
        assert.deepStrictEqual(h.items().map(i => i.value), ['a', 'b']);
        // Timers may fire a millisecond early.
        assert.ok(nextTook >= delay - 5, `the next item waits for the delay, took ${nextTook} ms`);

        const doneTook = await elapsed(() => h.ack('each-run-1', 1));
        assert.strictEqual(h.dones().length, 1);
        assert.ok(doneTook < delay, `no delay before done, took ${doneTook} ms`);
    });

    it('should leave the non-sequential paths untouched (done carries an empty result)', async () => {
        const h = createHarness();

        await h.start({ list: ['a', 'b', 'c'] });

        assert.deepStrictEqual(h.items().map(i => i.value), ['a', 'b', 'c']);
        assert.deepStrictEqual(h.dones(), [{ count: 3, correlationId: 'each-run-1', result: [] }]);
        assert.deepStrictEqual(h.flowState, {});
        assert.strictEqual(h.state['items:each-run-1'], undefined);
    });

    it('should keep the order with a loop body of random latency (the reported problem)', async () => {
        const h = createHarness();
        const list = Array.from({ length: 25 }, (_, i) => `item-${i}`);
        const processed = [];
        let inFlight = 0;
        let maxInFlight = 0;

        // The loop body: take whatever Each emitted last, "work" for a random time, then acknowledge
        // through the real ContinueEach component, adding the "created record id" to the result.
        const runBody = async item => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 8)));
            processed.push(item.value);
            inFlight--;

            const { correlationId, index } = item;
            await h.continueEach({ correlationId, index, result: { ADD: [{ name: 'id', value: `id-of-${item.value}` }] } });
        };

        await h.start({ list, sequential: true });

        let handled = 0;
        while (h.dones().length === 0) {
            const items = h.items();
            assert.ok(handled < items.length, 'the loop stalled');
            await runBody(items[handled++]);
            // ContinueEach posted to the webhook URL of Each with the original correlation...
            const last = h.triggered[h.triggered.length - 1];
            assert.strictEqual(last.componentId, 'each-1');
            assert.deepStrictEqual(last.query, {
                correlationId: 'corr-1', correlationInPort: 'in', messageId: 'msg-1', enqueueOnly: 'true'
            });
            // ...and the engine delivers it on the webhook port.
            await h.deliverLast();
        }

        assert.deepStrictEqual(processed, list);
        assert.strictEqual(maxInFlight, 1);
        assert.deepStrictEqual(h.dones()[0].result, list.map(value => ({ id: `id-of-${value}` })));
    });
});

describe('ContinueEach Component', () => {

    afterEach(() => {
        sinon.restore();
    });

    const TARGET = {
        componentId: 'each-1',
        webhookQuery: { correlationId: 'corr-1', correlationInPort: 'in', messageId: 'msg-1' }
    };

    const createContext = (content, target = TARGET) => {
        // null = no loop is waiting (undefined would fall back to the default target).

        const context = createMockContext({ messages: { in: { content } }, properties: {} });
        context.flowId = 'flow-1';
        context.log = sinon.stub();
        context.flow = { stateGet: sinon.stub().resolves(target) };
        context.callAppmixer = sinon.stub().resolves({ message: 'Enqueued.' });
        return context;
    };

    it('should wake the Each up through its webhook URL and pass the ids on', async () => {
        const context = createContext({ correlationId: 'run-1', index: '2' });

        await ContinueEach.receive(context);

        assert.ok(context.flow.stateGet.calledOnceWith('each:run-1'));
        assert.deepStrictEqual(context.callAppmixer.getCall(0).args[0], {
            endPoint: '/flows/flow-1/components/each-1' +
                '?correlationId=corr-1&correlationInPort=in&messageId=msg-1&enqueueOnly=true',
            method: 'POST',
            body: { id: 'run-1', index: 2, result: {} }
        });
        assert.ok(context.sendJson.calledOnceWith({ correlationId: 'run-1', index: 2 }, 'out'));
    });

    it('should send the rows of "Add to Result" as one entry, null for an unresolved value', async () => {
        const context = createContext({
            correlationId: 'run-1',
            index: 0,
            result: { ADD: [
                { name: 'ts', value: '1718888888.1' },
                { name: 'user', value: undefined },
                { name: ' count ', value: 0 },
                { name: 'raw', value: { a: 1 } },
                // An unused, completely empty row.
                { name: '', value: '' }
            ] }
        });

        await ContinueEach.receive(context);

        assert.deepStrictEqual(context.callAppmixer.getCall(0).args[0].body, {
            id: 'run-1', index: 0, result: { ts: '1718888888.1', user: null, count: 0, raw: { a: 1 } }
        });
    });

    it('should throw CancelError for an "Add to Result" row with a value but no name', async () => {
        const context = createContext({
            correlationId: 'run-1',
            index: 0,
            result: { ADD: [{ name: 'ts', value: '1' }, { value: 'orphan' }] }
        });

        await assert.rejects(
            async () => ContinueEach.receive(context),
            err => err instanceof context.CancelError && err.message.includes('row 2')
        );
        assert.ok(context.callAppmixer.notCalled);
    });

    it('should cope with a target without correlation (no scope to restore)', async () => {
        const context = createContext({ correlationId: 'run-1', index: 1 }, { componentId: 'each-1' });

        await ContinueEach.receive(context);

        assert.strictEqual(
            context.callAppmixer.getCall(0).args[0].endPoint,
            '/flows/flow-1/components/each-1?enqueueOnly=true'
        );
    });

    it('should continue the flow when no loop is waiting', async () => {
        const context = createContext({ correlationId: 'run-1', index: 1 }, null);

        await ContinueEach.receive(context);

        assert.ok(context.callAppmixer.notCalled);
        assert.ok(context.log.calledOnce);
        assert.ok(context.sendJson.calledOnceWith({ correlationId: 'run-1', index: 1 }, 'out'));
    });

    it('should fail when the engine rejects the acknowledgement (nothing is swallowed)', async () => {
        const context = createContext({ correlationId: 'run-1', index: 1 });
        context.callAppmixer.rejects(new Error('Service Unavailable'));

        await assert.rejects(async () => ContinueEach.receive(context), /Service Unavailable/);
        assert.ok(context.sendJson.notCalled);
    });

    it('should throw CancelError without a Correlation ID', async () => {
        const context = createContext({ index: 1 });

        await assert.rejects(
            async () => ContinueEach.receive(context),
            err => err instanceof context.CancelError && err.message.includes('Correlation ID')
        );
        assert.ok(context.callAppmixer.notCalled);
    });

    it('should throw CancelError for a missing or invalid index', async () => {
        for (const bad of [undefined, null, '', 'foo', -1, 1.5]) {
            const context = createContext({ correlationId: 'run-1', index: bad });

            await assert.rejects(
                async () => ContinueEach.receive(context),
                err => err instanceof context.CancelError && err.message.includes('Index')
            );
            assert.ok(context.callAppmixer.notCalled);
        }
    });
});

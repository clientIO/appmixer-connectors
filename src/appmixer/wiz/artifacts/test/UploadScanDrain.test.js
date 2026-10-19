'use strict';

const assert = require('assert');
const path = require('path');
const { createMockWiz } = require('./mockWiz');
const { createWizContext } = require('./mockContext');

const UploadScan = require(path.join(__dirname, '../../core/UploadScan/UploadScan.js'));

// Fast polling so tests do not sleep for real.
const FAST_CONFIG = { statusPollingInterval: '1', statusNumberOfAttempts: '3', uploadLockRetryDelay: '1' };

const seedBacklog = async (context, size) => {
    await context.stateSet('metadata', { filename: 'stress.json', integrationId: 'integration-1' });
    await context.stateSet('documents',
        Array.from({ length: size }, (_, i) => ({ id: `doc-${i}`, data: { n: i } })));
};

const receiveDocument = (context, document) => {
    context.messages = { in: { content: { document, filename: 'stress.json', integrationId: 'integration-1' } } };
    return UploadScan.receive(context);
};

const receiveTimeout = (context, timeoutId, content) => {
    context.messages = { timeout: { timeoutId, content } };
    return UploadScan.receive(context);
};

// Replay scheduled drain-continuation timeouts the way the engine would,
// returning the number of receive() invocations it took to drain the backlog.
const drainViaContinuations = async (context, { maxIterations = 1000 } = {}) => {
    let iterations = 0;
    let cursor = 0;
    while (cursor < context.scheduledTimeouts.length) {
        const { timeoutId, payload } = context.scheduledTimeouts[cursor++];
        if (!payload || !payload.drainContinuation) continue;
        iterations++;
        assert.ok(iterations <= maxIterations, 'continuation drain does not terminate');
        await receiveTimeout(context, timeoutId, payload);
    }
    return iterations;
};

describe('wiz UploadScan bounded drain', function() {

    this.timeout(20000);

    it('threshold mode: one receive() uploads exactly one batch and schedules a continuation', async () => {
        const { httpRequest, state } = createMockWiz();
        const context = createWizContext({
            httpRequest,
            config: FAST_CONFIG,
            properties: { threshold: 10, scheduleValue: 1, scheduleType: 'hours' }
        });
        await seedBacklog(context, 100);

        await receiveDocument(context, { n: 'new' });

        assert.strictEqual(state.uploads.length, 1, 'exactly one PUT upload per receive()');
        assert.strictEqual(state.uploads[0].dataSources.length, 10, 'one threshold-sized batch');
        assert.strictEqual((await context.stateGet('documents')).length, 91, '101 - 10 remain pending');

        const continuations = context.scheduledTimeouts.filter(t => t.payload?.drainContinuation);
        assert.strictEqual(continuations.length, 1, 'the rest of the backlog is handed to a timeout');
        assert.strictEqual(continuations[0].payload.threshold, 10);
    });

    it('continuations drain the backlog one batch per invocation until below threshold', async () => {
        const { httpRequest, state } = createMockWiz();
        const context = createWizContext({
            httpRequest,
            config: FAST_CONFIG,
            properties: { threshold: 10, scheduleValue: 1, scheduleType: 'hours' }
        });
        await seedBacklog(context, 100);

        await receiveDocument(context, { n: 'new' }); // 101 pending -> 1 batch + continuation
        const iterations = await drainViaContinuations(context);

        // 101 documents, threshold 10: 10 uploads of 10, 1 document left below threshold.
        assert.strictEqual(iterations, 9, 'nine continuation invocations after the initial receive');
        assert.strictEqual(state.uploads.length, 10);
        state.uploads.forEach(u => assert.strictEqual(u.dataSources.length, 10));
        assert.strictEqual((await context.stateGet('documents')).length, 1);
        assert.strictEqual(context.sent.filter(m => m.port === 'out').length, 10,
            'each uploaded batch emits one out message');
    });

    it('stress: a 2000-document backlog drains fully, never more than one upload per receive()', async () => {
        const { httpRequest, state } = createMockWiz();
        const context = createWizContext({
            httpRequest,
            config: FAST_CONFIG,
            properties: { threshold: 100, scheduleValue: 1, scheduleType: 'hours' }
        });
        await seedBacklog(context, 2000);

        let callsBefore = state.calls.length;
        await receiveDocument(context, { n: 'new' });
        // Per receive: 1 requestUpload + 1 PUT + >=1 status poll. With an instant
        // SUCCESS that is exactly 3 requests — the receive() is bounded.
        assert.strictEqual(state.calls.length - callsBefore, 3);

        const iterations = await drainViaContinuations(context);
        assert.strictEqual(iterations, 19, '2001 docs / 100 per batch -> 20 uploads total');
        assert.strictEqual(state.uploads.length, 20);
        assert.strictEqual((await context.stateGet('documents')).length, 1);
    });

    it('scheduled drain with a threshold batches the backlog instead of one oversized PUT', async () => {
        const { httpRequest, state } = createMockWiz();
        const context = createWizContext({
            httpRequest,
            config: FAST_CONFIG,
            properties: { threshold: 100, scheduleValue: 1, scheduleType: 'hours' }
        });
        await seedBacklog(context, 250);
        await context.stateSet('timeoutId', 'sched-1');

        await receiveTimeout(context, 'sched-1', {});
        const iterations = await drainViaContinuations(context);

        // 250 docs, threshold 100: 100 + 100 + final 50 (below-threshold remainder
        // is still drained because this is a timeout drain).
        assert.strictEqual(iterations, 2, 'two continuation invocations after the scheduled drain');
        assert.deepStrictEqual(state.uploads.map(u => u.dataSources.length), [100, 100, 50]);
        assert.strictEqual(((await context.stateGet('documents')) || []).length, 0, 'backlog fully drained');
    });

    it('scheduled drain without a threshold uploads everything in a single batch and re-schedules itself', async () => {
        const { httpRequest, state } = createMockWiz();
        const context = createWizContext({
            httpRequest,
            config: FAST_CONFIG,
            properties: { threshold: 0, scheduleValue: 1, scheduleType: 'hours' }
        });
        await seedBacklog(context, 500);
        await context.stateSet('timeoutId', 'sched-1');

        await receiveTimeout(context, 'sched-1', {});

        assert.strictEqual(state.uploads.length, 1);
        assert.strictEqual(state.uploads[0].dataSources.length, 500);
        assert.strictEqual(await context.stateGet('documents'), undefined, 'backlog fully drained');
        const schedules = context.scheduledTimeouts.filter(t => !t.payload?.drainContinuation);
        assert.strictEqual(schedules.length, 1, 'next scheduled drain is planned');
    });

    it('immediate mode (no schedule, no threshold) uploads on every message without continuations', async () => {
        const { httpRequest, state } = createMockWiz();
        const context = createWizContext({ httpRequest, config: FAST_CONFIG, properties: {} });

        await receiveDocument(context, { n: 1 });

        assert.strictEqual(state.uploads.length, 1);
        assert.strictEqual(state.uploads[0].dataSources.length, 1);
        assert.strictEqual(context.scheduledTimeouts.length, 0);
    });

    it('a failed status poll propagates, clears the upload batch and releases the locks', async () => {
        const { httpRequest, state } = createMockWiz({ failStatusForever: true });
        const context = createWizContext({ httpRequest, config: FAST_CONFIG, properties: {} });

        await assert.rejects(() => receiveDocument(context, { n: 1 }), /Exceeded max attempts|time budget/);
        assert.strictEqual(await context.stateGet('documents-upload-batch'), undefined,
            'the in-flight batch marker must not survive a failure');

        // The component must still be usable afterwards (locks were released).
        const { httpRequest: okRequest, state: okState } = createMockWiz();
        context.httpRequest = okRequest;
        await receiveDocument(context, { n: 2 });
        assert.strictEqual(okState.uploads.length, 1);
        void state;
    });

    it('never re-uploads a batch another receive() is still uploading', async () => {
        // The pre-lock "upload already in progress" check races with the receive()
        // that prepared the batch; a live E2E burst of 25 documents uploaded 60.
        const { httpRequest, state } = createMockWiz();
        const context = createWizContext({ httpRequest, config: FAST_CONFIG, properties: { threshold: 10 } });
        await context.stateSet('metadata', { filename: 'stress.json', integrationId: 'integration-1' });
        await context.stateSet('documents-upload-batch',
            Array.from({ length: 10 }, (unused, i) => ({ id: `inflight-${i}`, data: { n: i } })));
        await context.stateSet('documents-upload-batch-startedAt', Date.now());

        const documents = await UploadScan.prepareForSend(context, { threshold: 10 });

        assert.deepStrictEqual(documents, [], 'a fresh in-flight batch must not be handed out twice');
        assert.strictEqual(state.uploads.length, 0);
    });

    it('resumes a batch left behind by a crashed run', async () => {
        const { httpRequest } = createMockWiz();
        const context = createWizContext({ httpRequest, config: FAST_CONFIG, properties: { threshold: 10 } });
        await context.stateSet('metadata', { filename: 'stress.json', integrationId: 'integration-1' });
        await context.stateSet('documents-upload-batch',
            Array.from({ length: 3 }, (unused, i) => ({ id: `orphan-${i}`, data: { n: i } })));
        // Older than the lock TTL: nobody can still be uploading it.
        await context.stateSet('documents-upload-batch-startedAt', Date.now() - (16 * 60 * 1000));

        const documents = await UploadScan.prepareForSend(context, { threshold: 10 });

        assert.strictEqual(documents.length, 3, 'a stale batch is crash leftover and must be resumed');
    });

    it('logs a warning once the backlog grows past 5000 documents', async () => {
        const { httpRequest } = createMockWiz();
        const context = createWizContext({
            httpRequest,
            config: FAST_CONFIG,
            // Schedule mode with a high threshold: the message only accumulates.
            properties: { threshold: 100000, scheduleValue: 1, scheduleType: 'hours' }
        });
        await seedBacklog(context, 5100);

        await receiveDocument(context, { n: 'new' });

        assert.ok(context.logs.some(l => typeof l.warning === 'string' && l.warning.includes('backlog')),
            'expected a backlog warning log entry');
    });
});

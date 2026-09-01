'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { google } = require('googleapis');
const lib = require('../../lib');

// Must mirror MAX_PAGES_PER_RUN in lib.js.
const PAGE_CAP = 20;

describe('google.drive.lib checkMonitoredFiles paging & locking', () => {

    let sandbox;
    let context;
    let lock;
    let listStub;

    // Serves `totalPages` pages named p0..p<totalPages>, one file per page so emissions
    // can be counted. Only the last page carries `newStartPageToken`, like the real API.
    const stubPages = (totalPages) => {
        listStub = sandbox.stub().callsFake(async ({ pageToken }) => {
            const page = parseInt(pageToken.slice(1), 10);
            const isLast = page === totalPages - 1;
            return {
                data: {
                    changes: [{ changeType: 'file', file: { id: `f${page}`, mimeType: 'text/plain' } }],
                    [isLast ? 'newStartPageToken' : 'nextPageToken']: `p${page + 1}`
                }
            };
        });
        sandbox.stub(google, 'drive').returns({ changes: { list: listStub } });
    };

    const startPageTokens = () => {
        return context.stateSet.getCalls()
            .filter(call => call.args[0] === 'startPageToken')
            .map(call => call.args[1]);
    };

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        lock = {
            extend: sandbox.stub().resolves(),
            unlock: sandbox.stub().resolves()
        };

        context = {
            auth: { accessToken: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' },
            properties: {},
            config: {},
            componentId: 'test-component',
            lock: sandbox.stub().resolves(lock),
            loadState: sandbox.stub().resolves({ startPageToken: 'p0', processedFiles: [] }),
            stateSet: sandbox.stub().resolves(),
            stateGet: sandbox.stub().resolves(),
            stateUnset: sandbox.stub().resolves(),
            sendJson: sandbox.stub().resolves(),
            log: sandbox.stub().resolves()
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should persist the page token after every page so a redelivery resumes', async () => {

        stubPages(3);

        await lib.checkMonitoredFiles(context, { filter: () => true });

        assert.strictEqual(listStub.callCount, 3);
        assert.strictEqual(context.sendJson.callCount, 3);
        // Progress is durable page by page, not only at the very end of the backlog.
        assert.deepStrictEqual(startPageTokens(), ['p1', 'p2', 'p3']);
        assert.strictEqual(lock.unlock.callCount, 1);
    });

    it('should extend the lock before every page with a realistic TTL', async () => {

        stubPages(3);

        await lib.checkMonitoredFiles(context, { filter: () => true });

        assert.strictEqual(lock.extend.callCount, 3);
        lock.extend.getCalls().forEach(call => assert.strictEqual(call.args[0], 60000));
    });

    it('should stop at the page cap and flag the rest of the backlog for the next tick', async () => {

        stubPages(1000);

        await lib.checkMonitoredFiles(context, { filter: () => true });

        assert.strictEqual(listStub.callCount, PAGE_CAP);
        assert.strictEqual(startPageTokens().pop(), `p${PAGE_CAP}`);
        assert.ok(context.stateSet.calledWith('hasSkippedMessage', true));
        assert.strictEqual(lock.unlock.callCount, 1);
    });

    it('should abort instead of paging on unprotected when the lock cannot be extended', async () => {

        stubPages(1000);
        lock.extend.onCall(1).rejects(new Error('lock expired'));

        await lib.checkMonitoredFiles(context, { filter: () => true });

        assert.strictEqual(listStub.callCount, 1);
        assert.ok(context.stateSet.calledWith('hasSkippedMessage', true));
        assert.strictEqual(lock.unlock.callCount, 1);
    });

    it('should not let an unlock failure mask the outcome', async () => {

        stubPages(1);
        lock.unlock.rejects(new Error('lock already released'));

        await lib.checkMonitoredFiles(context, { filter: () => true });

        assert.ok(context.log.calledWithMatch({ step: 'unlock-failed' }));
    });

    it('should skip the run when the component lock is already held', async () => {

        stubPages(1);
        context.lock.rejects(new Error('Exceeded 0 attempts to lock the resource'));

        await lib.checkMonitoredFiles(context, { filter: () => true });

        assert.strictEqual(listStub.callCount, 0);
        assert.ok(context.stateSet.calledWith('hasSkippedMessage', true));
    });

});

describe('google.drive.lib registerWebhook lock contention', () => {

    let sandbox;
    let context;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        context = {
            auth: { accessToken: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' },
            componentId: 'test-component',
            lock: sandbox.stub().rejects(new Error('Exceeded 30 attempts to lock the resource')),
            loadState: sandbox.stub().resolves({}),
            stateGet: sandbox.stub().resolves(),
            stateSet: sandbox.stub().resolves(),
            log: sandbox.stub().resolves()
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should skip the renewal instead of throwing when called with maxRetryCount 0', async () => {

        await lib.registerWebhook(context, { maxRetryCount: 0 });

        assert.deepStrictEqual(context.lock.firstCall.args[1], { maxRetryCount: 0 });
        assert.ok(context.log.calledWithMatch({ step: 'webhook-renewal-skipped' }));
        assert.strictEqual(context.stateSet.callCount, 0);
    });

    it('should still throw for start(), which has no next attempt', async () => {

        await assert.rejects(
            () => lib.registerWebhook(context),
            /Exceeded 30 attempts to lock the resource/);
    });

});

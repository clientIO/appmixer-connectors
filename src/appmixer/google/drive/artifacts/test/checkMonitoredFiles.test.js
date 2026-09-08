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

    it('should swallow a failing unlock-failure log instead of throwing out of finally', async () => {

        stubPages(1);
        lock.unlock.rejects(new Error('lock already released'));
        context.log.rejects(new Error('log backend down'));

        await lib.checkMonitoredFiles(context, { filter: () => true });

        // One file emitted, page token persisted: the outcome of the run is intact.
        assert.strictEqual(context.sendJson.callCount, 1);
        assert.deepStrictEqual(startPageTokens(), ['p1']);
    });

    it('should skip the run when the component lock is already held', async () => {

        stubPages(1);
        context.lock.rejects(new Error('Exceeded 0 attempts to lock the resource'));

        await lib.checkMonitoredFiles(context, { filter: () => true });

        assert.strictEqual(listStub.callCount, 0);
        assert.ok(context.stateSet.calledWith('hasSkippedMessage', true));
    });

    it('should remember processed ids across many pages so a re-listed file is not emitted again', async () => {

        // 30 pages, one file each, then the file from page 0 shows up again on the last page
        // (Drive re-lists a fresh file with a bumped version a few minutes after creation).
        const TOTAL = 30;
        listStub = sandbox.stub().callsFake(async ({ pageToken }) => {
            const page = parseInt(pageToken.slice(1), 10);
            const isLast = page === TOTAL - 1;
            const changes = [{ changeType: 'file', file: { id: `f${page}`, mimeType: 'text/plain' } }];
            if (isLast) changes.push({ changeType: 'file', file: { id: 'f0', mimeType: 'text/plain', version: 2 } });
            return { data: { changes, [isLast ? 'newStartPageToken' : 'nextPageToken']: `p${page + 1}` } };
        });
        sandbox.stub(google, 'drive').returns({ changes: { list: listStub } });

        // Two invocations because of the page cap; the second one loads the state the first left.
        let processed = [];
        context.stateSet.callsFake(async (key, value) => { if (key === 'processedFiles') processed = value; });
        context.loadState.callsFake(async () => ({ startPageToken: startPageTokens().pop() || 'p0', processedFiles: processed }));
        await lib.checkMonitoredFiles(context, { filter: () => true });
        await lib.checkMonitoredFiles(context, { filter: () => true });

        const emittedIds = context.sendJson.getCalls().map(call => call.args[0].googleDriveFileMetadata.id);
        assert.strictEqual(emittedIds.length, TOTAL);
        assert.strictEqual(emittedIds.filter(id => id === 'f0').length, 1);
    });

    it('should drop the oldest page groups once the processed-id buffer exceeds its cap', () => {

        const buffer = lib.processedItemsBuffer([]);
        for (let page = 0; page < 12; page++) {
            for (let i = 0; i < 1000; i++) buffer.add(`p${page}`, `f${page}-${i}`);
        }
        const kept = buffer.export();
        assert.strictEqual(kept.length, 5);
        assert.strictEqual(kept[0].group, 'p7');
        assert.ok(lib.processedItemsBuffer(kept).has('f11-999'));
        assert.ok(!lib.processedItemsBuffer(kept).has('f6-0'));
    });

    it('should rebuild the subfolder list and re-filter the same page when a page reports a new subfolder', async () => {

        // Recursive watch on `root`, cached subfolder list is stale (no `sub`).
        context.properties = { folder: { id: 'root' }, recursive: true };
        context.stateGet.withArgs('cachedFolderIds').resolves(['root']);

        // One page: a new subfolder `sub` under root, then a file inside `sub`.
        const changes = [
            { changeType: 'file', file: { id: 'sub', mimeType: 'application/vnd.google-apps.folder', parents: ['root'] } },
            { changeType: 'file', file: { id: 'inner', mimeType: 'text/plain', parents: ['sub'] } }
        ];
        listStub = sandbox.stub().resolves({ data: { changes, newStartPageToken: 'p1' } });
        const filesListStub = sandbox.stub().callsFake(async ({ q }) => ({
            data: { files: q.startsWith("'root'") ? [{ id: 'sub', mimeType: 'application/vnd.google-apps.folder' }] : [] }
        }));
        sandbox.stub(google, 'drive').returns({ changes: { list: listStub }, files: { list: filesListStub } });

        await lib.checkMonitoredFiles(context, { filter: () => true });

        // The page was fetched twice: once against the stale list, once against the rebuilt one.
        assert.strictEqual(listStub.callCount, 2);
        assert.ok(context.stateSet.calledWith('cachedFolderIds', ['root', 'sub']));
        // The file under the brand-new subfolder is emitted instead of being lost.
        const emittedIds = context.sendJson.getCalls().map(call => call.args[0].googleDriveFileMetadata.id);
        assert.ok(emittedIds.includes('inner'), `expected 'inner' to be emitted, got ${JSON.stringify(emittedIds)}`);
        assert.deepStrictEqual(startPageTokens(), ['p1']);
        // The rebuilt list is fresh, so the cache stays.
        assert.strictEqual(context.stateUnset.callCount, 0);
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

        assert.deepStrictEqual(context.lock.firstCall.args[1], { maxRetryCount: 0, ttl: 60000 });
        assert.ok(context.log.calledWithMatch({ step: 'webhook-renewal-skipped' }));
        assert.strictEqual(context.stateSet.callCount, 0);
    });

    it('should still throw for start(), which has no next attempt', async () => {

        await assert.rejects(
            () => lib.registerWebhook(context),
            /Exceeded 30 attempts to lock the resource/);
    });

});

describe('google.drive.lib registerWebhook startPageToken handling', () => {

    let sandbox;
    let context;
    let lock;
    let getStartPageTokenStub;

    const startPageTokenWrites = () => {
        return context.stateSet.getCalls()
            .filter(call => call.args[0] === 'startPageToken')
            .map(call => call.args[1]);
    };

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        lock = { extend: sandbox.stub().resolves(), unlock: sandbox.stub().resolves() };
        getStartPageTokenStub = sandbox.stub().resolves({ data: { startPageToken: 'fresh' } });
        sandbox.stub(google, 'drive').returns({
            changes: {
                getStartPageToken: getStartPageTokenStub,
                watch: sandbox.stub().resolves({ data: { resourceId: 'res-1' } })
            },
            channels: { stop: sandbox.stub().resolves() }
        });
        context = {
            auth: { accessToken: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' },
            componentId: 'test-component',
            lock: sandbox.stub().resolves(lock),
            loadState: sandbox.stub().resolves({}),
            stateGet: sandbox.stub().resolves(),
            stateSet: sandbox.stub().resolves(),
            log: sandbox.stub().resolves(),
            getWebhookUrl: () => 'https://example.test/webhook'
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should hold the lock with the same TTL checkMonitoredFiles uses', async () => {

        await lib.registerWebhook(context);

        assert.deepStrictEqual(context.lock.firstCall.args[1], { ttl: 60000 });
        assert.strictEqual(lock.unlock.callCount, 1);
    });

    it('should re-arm the lock before each Drive call so the TTL only has to cover one of them', async () => {

        await lib.registerWebhook(context);

        // First registration: getStartPageToken + changes.watch, one extension before each.
        assert.strictEqual(lock.extend.callCount, 2);
        lock.extend.getCalls().forEach(call => assert.strictEqual(call.args[0], 60000));
        assert.ok(lock.extend.firstCall.calledBefore(getStartPageTokenStub.firstCall));
    });

    it('should re-arm the lock once on renewal, before changes.watch', async () => {

        context.stateGet.withArgs('startPageToken').resolves('p42');

        await lib.registerWebhook(context);

        assert.strictEqual(lock.extend.callCount, 1);
    });

    it('should persist a freshly obtained startPageToken on first registration', async () => {

        await lib.registerWebhook(context);

        assert.strictEqual(getStartPageTokenStub.callCount, 1);
        assert.deepStrictEqual(startPageTokenWrites(), ['fresh']);
    });

    it('should leave an existing startPageToken untouched on renewal', async () => {

        context.stateGet.withArgs('startPageToken').resolves('p42');

        await lib.registerWebhook(context);

        // Renewal must not write the (possibly stale) token back over progress persisted by
        // a concurrent checkMonitoredFiles() run.
        assert.strictEqual(getStartPageTokenStub.callCount, 0);
        assert.deepStrictEqual(startPageTokenWrites(), []);
        assert.ok(context.stateSet.calledWith('webhookId', 'res-1'));
    });

});

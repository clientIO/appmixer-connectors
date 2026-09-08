'use strict';

const assert = require('assert');
const sinon = require('sinon');

const commons = require('../../../microsoft-commons');
const delta = require('../../../microsoft-delta');
const NewFile = require('../../../sharepoint/NewFile/NewFile');
const UpdatedFile = require('../../../sharepoint/UpdatedFile/UpdatedFile');
const DeletedFile = require('../../../sharepoint/DeletedFile/DeletedFile');
const OneDriveNewFile = require('../../../onedrive/NewFile/NewFile');

const LAST_UPDATED = '2026-01-01T00:00:00.000Z';
const FAR_FUTURE = '2099-01-01T00:00:00.000Z';

const file = (id, overrides = {}) => Object.assign({
    id,
    name: `${id}.txt`,
    file: { mimeType: 'text/plain' },
    createdDateTime: '2026-01-02T00:00:00.000Z',
    lastModifiedDateTime: '2026-01-02T00:00:00.000Z'
}, overrides);

describe('Microsoft delta file triggers', () => {

    let sandbox;
    let context;
    let lock;

    // Two-page delta chain: `first` on page p0, `second` on the final page p1.
    const stubChain = (first, second) => {
        const getStub = sandbox.stub(commons, 'get');
        getStub.withArgs('p0').resolves({ value: first, '@odata.nextLink': 'p1' });
        getStub.withArgs('p1').resolves({ value: second, '@odata.deltaLink': 'd' });
        return getStub;
    };

    const webhookMessage = (clientState = 'test-component') => ({
        webhook: { content: { query: {}, data: { value: [{ clientState }] } } }
    });

    const savedLinks = () => {
        return context.stateSet.getCalls()
            .filter(call => call.args[0] === 'deltaLink')
            .map(call => call.args[1]);
    };

    const emittedIds = () => context.sendJson.getCalls().map(call => call.args[0].id);

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        lock = {
            extend: sandbox.stub().resolves(),
            unlock: sandbox.stub().resolves()
        };

        context = {
            auth: { accessToken: 'test-token' },
            properties: { driveId: 'drive-1' },
            config: {},
            componentId: 'test-component',
            messages: {},
            lock: sandbox.stub().resolves(lock),
            loadState: sandbox.stub().resolves({ deltaLink: 'p0', lastUpdated: LAST_UPDATED }),
            saveState: sandbox.stub().resolves(),
            stateSet: sandbox.stub().resolves(),
            sendJson: sandbox.stub().resolves(),
            sendArray: sandbox.stub().resolves(),
            response: sandbox.stub().resolves(),
            getWebhookUrl: sandbox.stub().returns('https://webhook.test/x'),
            log: sandbox.stub().resolves()
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('sharepoint NewFile', () => {

        it('should emit the new files of each page and persist the resume link per page', async () => {

            stubChain(
                [file('new-1'), file('old-1', { createdDateTime: '2025-06-01T00:00:00.000Z' })],
                [file('new-2'), { id: 'folder-1', folder: {} }]);
            context.messages = webhookMessage();

            await NewFile.receive(context);

            assert.deepStrictEqual(emittedIds(), ['new-1', 'new-2']);
            assert.deepStrictEqual(savedLinks(), ['p1', 'd']);
            assert.strictEqual(lock.unlock.callCount, 1);
            assert.strictEqual(context.response.callCount, 1);
        });

        it('should advance the lastUpdated watermark only once the chain is drained', async () => {

            stubChain([file('new-1')], [file('new-2')]);
            context.messages = webhookMessage();

            await NewFile.receive(context);

            const watermarks = context.stateSet.getCalls().filter(call => call.args[0] === 'lastUpdated');
            assert.strictEqual(watermarks.length, 1);
        });

        it('should honour the fileTypesRestriction without emitting a file twice', async () => {

            stubChain([file('doc', { file: { mimeType: 'application/pdf' } })], [file('img', { file: { mimeType: 'image/png' } })]);
            context.properties.fileTypesRestriction = ['application/', 'application/pdf'];
            context.messages = webhookMessage();

            await NewFile.receive(context);

            assert.deepStrictEqual(emittedIds(), ['doc']);
        });

        it('should discard the batch when a clientState does not match', async () => {

            const getStub = stubChain([file('new-1')], []);
            context.messages = webhookMessage('someone-else');

            await NewFile.receive(context);

            assert.strictEqual(getStub.callCount, 0);
            assert.strictEqual(context.sendJson.callCount, 0);
            assert.strictEqual(context.response.callCount, 1);
        });

        it('should answer the Graph subscription validation handshake without touching the delta', async () => {

            const getStub = stubChain([file('new-1')], []);
            context.messages = { webhook: { content: { query: { validationToken: 'vt' } } } };

            await NewFile.receive(context);

            assert.strictEqual(getStub.callCount, 0);
            assert.ok(context.response.calledWith('vt'));
        });

        it('should establish the start() baseline without enumerating the drive', async () => {

            const getStub = sandbox.stub(commons, 'get').resolves({ value: [], '@odata.deltaLink': 'baseline' });
            sandbox.stub(commons, 'post').resolves({ id: 'w1', expirationDateTime: 'e1' });

            await NewFile.start(context);

            assert.strictEqual(getStub.callCount, 1);
            assert.strictEqual(getStub.firstCall.args[0], '/drives/drive-1/root/delta?token=latest');
            assert.strictEqual(context.saveState.firstCall.args[0].deltaLink, 'baseline');
        });

        it('should continue a deferred backlog from tick()', async () => {

            const getStub = stubChain([file('new-1')], [file('new-2')]);
            context.loadState.resolves({
                deltaLink: 'p0',
                lastUpdated: LAST_UPDATED,
                webhookId: 'w1',
                expiryDate: FAR_FUTURE,
                [delta.SKIPPED_FLAG]: true
            });

            await NewFile.tick(context);

            assert.strictEqual(getStub.callCount, 2);
            assert.deepStrictEqual(emittedIds(), ['new-1', 'new-2']);
        });

        it('should not touch the delta from tick() when nothing was deferred', async () => {

            const getStub = stubChain([file('new-1')], []);
            context.loadState.resolves({
                deltaLink: 'p0',
                lastUpdated: LAST_UPDATED,
                webhookId: 'w1',
                expiryDate: FAR_FUTURE
            });

            await NewFile.tick(context);

            assert.strictEqual(getStub.callCount, 0);
        });

        it('should not touch the delta from tick() when there is no subscription at all', async () => {

            const getStub = stubChain([file('new-1')], []);
            context.loadState.resolves({ deltaLink: 'p0', [delta.SKIPPED_FLAG]: true });

            await NewFile.tick(context);

            assert.strictEqual(getStub.callCount, 0);
            assert.strictEqual(context.lock.callCount, 0);
        });

        it('should skip the webhook renewal instead of storming a contended lock', async () => {

            const patchStub = sandbox.stub(commons, 'patch').resolves({ expirationDateTime: 'e2' });
            context.loadState.resolves({ webhookId: 'w1', expiryDate: '2020-01-01T00:00:00.000Z' });
            context.lock.rejects(new Error('Exceeded 30 attempts to lock the resource'));

            await NewFile.tick(context);

            assert.strictEqual(patchStub.callCount, 0);
            assert.ok(context.log.calledWithMatch({ step: 'webhook-renewal-skipped' }));
        });

        it('should renew the subscription without clobbering the delta progress', async () => {

            const patchStub = sandbox.stub(commons, 'patch').resolves({ expirationDateTime: 'e2' });
            context.loadState.resolves({ webhookId: 'w1', expiryDate: '2020-01-01T00:00:00.000Z', deltaLink: 'p0' });

            await NewFile.tick(context);

            assert.strictEqual(patchStub.callCount, 1);
            assert.ok(context.stateSet.calledWith('expiryDate', 'e2'));
            assert.strictEqual(context.saveState.callCount, 0);
            assert.strictEqual(lock.unlock.callCount, 1);
        });

        it('should recreate a subscription that Graph no longer knows about', async () => {

            const notFound = new Error('404 - not found');
            notFound.statusCode = 404;
            sandbox.stub(commons, 'patch').rejects(notFound);
            sandbox.stub(commons, 'post').resolves({ id: 'w2', expirationDateTime: 'e3' });
            context.loadState.resolves({ webhookId: 'w1', expiryDate: '2020-01-01T00:00:00.000Z' });

            await NewFile.tick(context);

            assert.ok(context.stateSet.calledWith('webhookId', 'w2'));
            assert.ok(context.stateSet.calledWith('expiryDate', 'e3'));
        });
    });

    describe('sharepoint UpdatedFile', () => {

        it('should emit only pre-existing, non-deleted files page by page', async () => {

            stubChain(
                [
                    file('updated-1', { createdDateTime: '2025-06-01T00:00:00.000Z' }),
                    file('created-now')
                ],
                [
                    file('removed-1', { createdDateTime: '2025-06-01T00:00:00.000Z', deleted: {} }),
                    file('updated-2', { createdDateTime: '2025-07-01T00:00:00.000Z' })
                ]);
            context.messages = webhookMessage();

            await UpdatedFile.receive(context);

            assert.deepStrictEqual(emittedIds(), ['updated-1', 'updated-2']);
            assert.deepStrictEqual(savedLinks(), ['p1', 'd']);
        });
    });

    describe('sharepoint DeletedFile', () => {

        it('should emit only deleted files page by page', async () => {

            stubChain(
                [file('gone-1', { deleted: {} }), file('alive-1')],
                [{ id: 'gone-folder', folder: {}, deleted: {} }, file('gone-2', { deleted: {} })]);
            context.messages = webhookMessage();

            await DeletedFile.receive(context);

            assert.deepStrictEqual(emittedIds(), ['gone-1', 'gone-2']);
            assert.deepStrictEqual(savedLinks(), ['p1', 'd']);
            assert.strictEqual(lock.unlock.callCount, 1);
        });

        it('should continue a deferred backlog from tick()', async () => {

            const getStub = stubChain([file('gone-1', { deleted: {} })], []);
            context.loadState.resolves({
                deltaLink: 'p0',
                webhookId: 'w1',
                expiryDate: FAR_FUTURE,
                [delta.SKIPPED_FLAG]: true
            });

            await DeletedFile.tick(context);

            assert.strictEqual(getStub.callCount, 2);
            assert.deepStrictEqual(emittedIds(), ['gone-1']);
        });
    });

    describe('onedrive NewFile', () => {

        it('should emit the new files of each page and persist the resume link per page', async () => {

            stubChain(
                [file('new-1'), file('old-1', { createdDateTime: '2025-06-01T00:00:00.000Z' })],
                [file('new-2')]);
            context.messages = webhookMessage();

            await OneDriveNewFile.receive(context);

            assert.deepStrictEqual(emittedIds(), ['new-1', 'new-2']);
            assert.deepStrictEqual(savedLinks(), ['p1', 'd']);
            assert.strictEqual(lock.unlock.callCount, 1);
        });

        it('should establish the start() baseline without enumerating the drive', async () => {

            const getStub = sandbox.stub(commons, 'get').resolves({ value: [], '@odata.deltaLink': 'baseline' });
            sandbox.stub(commons, 'post').resolves({ id: 'w1', expirationDateTime: 'e1' });

            await OneDriveNewFile.start(context);

            assert.strictEqual(getStub.firstCall.args[0], '/me/drive/root/delta?token=latest');
            assert.strictEqual(context.saveState.firstCall.args[0].deltaLink, 'baseline');
        });
    });
});

'use strict';

const assert = require('assert');
const sinon = require('sinon');

const commons = require('../../../microsoft-commons');
const delta = require('../../../microsoft-delta');
const WatchLocation = require('../../../sharepoint/WatchLocation/WatchLocation');

describe('Microsoft SharePoint WatchLocation', () => {

    let sandbox;
    let context;
    let lock;

    const item = (id, createdDateTime, lastModifiedDateTime) => ({
        id,
        file: { mimeType: 'text/plain' },
        createdDateTime,
        lastModifiedDateTime
    });

    const savedLinks = () => {
        return context.stateSet.getCalls()
            .filter(call => call.args[0] === 'deltaLink')
            .map(call => call.args[1]);
    };

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
            lock: sandbox.stub().resolves(lock),
            loadState: sandbox.stub().resolves({ deltaLink: 'p0' }),
            saveState: sandbox.stub().resolves(),
            stateSet: sandbox.stub().resolves(),
            sendArray: sandbox.stub().resolves(),
            sendJson: sandbox.stub().resolves(),
            log: sandbox.stub().resolves()
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should establish the baseline without enumerating the location', async () => {

        const getStub = sandbox.stub(commons, 'get').resolves({ value: [], '@odata.deltaLink': 'baseline' });

        await WatchLocation.start(context);

        assert.strictEqual(getStub.callCount, 1);
        assert.strictEqual(getStub.firstCall.args[0], '/drives/drive-1/items/root/delta?token=latest');
        assert.deepStrictEqual(context.saveState.firstCall.args[0], { deltaLink: 'baseline' });
    });

    it('should emit each page before persisting its resume link', async () => {

        const getStub = sandbox.stub(commons, 'get');
        getStub.withArgs('p0').resolves({
            value: [item('a', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')],
            '@odata.nextLink': 'p1'
        });
        getStub.withArgs('p1').resolves({
            value: [item('b', '2026-01-01T00:00:00.000Z', '2026-01-05T00:00:00.000Z')],
            '@odata.deltaLink': 'd'
        });

        await WatchLocation.tick(context);

        assert.strictEqual(context.sendArray.callCount, 2);
        assert.deepStrictEqual(context.sendArray.firstCall.args[0].map(c => c.status), ['new']);
        assert.deepStrictEqual(context.sendArray.secondCall.args[0].map(c => c.status), ['modified']);
        // Emitting before saving means a crash replays a page instead of dropping it.
        sinon.assert.callOrder(context.sendArray, context.stateSet);
        assert.deepStrictEqual(savedLinks(), ['p1', 'd']);
        assert.strictEqual(lock.unlock.callCount, 1);
    });

    it('should classify a recorded Graph delta page exactly as before', async () => {

        const recorded = require('../../../sharepoint/WatchLocation/samples/delta.json');
        sandbox.stub(commons, 'get').resolves(recorded);

        await WatchLocation.tick(context);

        // The bare folder item carries no `file` and is dropped; the deleted item has no
        // timestamps so it stays unclassified.
        assert.deepStrictEqual(
            context.sendArray.firstCall.args[0].map(c => c.status),
            [undefined, 'modified', 'modified', 'new']);
        assert.deepStrictEqual(savedLinks(), [recorded['@odata.deltaLink']]);
    });

    it('should stop at the page cap and resume on the next tick', async () => {

        const getStub = sandbox.stub(commons, 'get').callsFake(async (link) => ({
            value: [item(link, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')],
            '@odata.nextLink': `${link}+`
        }));

        await WatchLocation.tick(context);

        assert.strictEqual(getStub.callCount, delta.MAX_PAGES_PER_RUN);
        assert.ok(context.log.calledWithMatch({ step: 'delta-backlog-deferred' }));
        assert.strictEqual(lock.unlock.callCount, 1);
    });

    it('should skip the tick when the component lock is already held', async () => {

        const getStub = sandbox.stub(commons, 'get').resolves({ value: [], '@odata.deltaLink': 'd' });
        context.lock.rejects(new Error('Exceeded 30 attempts to lock the resource'));

        await WatchLocation.tick(context);

        assert.strictEqual(getStub.callCount, 0);
        assert.ok(context.log.calledWithMatch({ step: 'delta-scan-skipped' }));
    });

    it('should require a Drive ID in Flow Test Mode', async () => {

        context.properties = {};
        context.CancelError = class extends Error {};

        await assert.rejects(() => WatchLocation.test(context), /Drive ID is required/);
    });
});

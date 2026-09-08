'use strict';

const assert = require('assert');
const sinon = require('sinon');

const commons = require('../../microsoft-commons');
const delta = require('../../microsoft-delta');

describe('microsoft-delta runDeltaScan paging & locking', () => {

    let sandbox;
    let context;
    let lock;
    let getStub;

    // Serves `totalPages` pages named p0..p<totalPages>, one item per page so emissions can be
    // counted. Only the last page carries `@odata.deltaLink`, like the real Graph delta API.
    const stubPages = (totalPages) => {
        getStub = sandbox.stub(commons, 'get').callsFake(async (link) => {
            const page = parseInt(link.slice(1), 10);
            const isLast = page === totalPages - 1;
            return {
                value: [{ id: `f${page}`, file: { mimeType: 'text/plain' } }],
                [isLast ? '@odata.deltaLink' : '@odata.nextLink']: `p${page + 1}`
            };
        });
    };

    const savedLinks = () => {
        return context.stateSet.getCalls()
            .filter(call => call.args[0] === 'deltaLink')
            .map(call => call.args[1]);
    };

    const scan = (overrides = {}) => {
        return delta.runDeltaScan(context, Object.assign({
            startLink: (state) => state.deltaLink,
            onPage: async (items) => {
                for (const item of items) {
                    await context.sendJson(item, 'file');
                }
            },
            saveProgress: async (link) => context.stateSet('deltaLink', link)
        }, overrides));
    };

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        lock = {
            extend: sandbox.stub().resolves(),
            unlock: sandbox.stub().resolves()
        };

        context = {
            auth: { accessToken: 'test-token' },
            properties: {},
            config: {},
            componentId: 'test-component',
            lock: sandbox.stub().resolves(lock),
            loadState: sandbox.stub().resolves({ deltaLink: 'p0' }),
            stateSet: sandbox.stub().resolves(),
            sendJson: sandbox.stub().resolves(),
            log: sandbox.stub().resolves()
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should take the lock with an explicit TTL and without retrying a contended lock', async () => {

        stubPages(1);

        await scan();

        assert.deepStrictEqual(context.lock.firstCall.args, [
            'test-component',
            { maxRetryCount: 0, ttl: delta.LOCK_TTL }
        ]);
    });

    it('should persist the resume link after every page so a redelivery resumes', async () => {

        stubPages(3);

        await scan();

        assert.strictEqual(getStub.callCount, 3);
        assert.strictEqual(context.sendJson.callCount, 3);
        // Progress is durable page by page, not only once the whole backlog is drained.
        assert.deepStrictEqual(savedLinks(), ['p1', 'p2', 'p3']);
        assert.strictEqual(lock.unlock.callCount, 1);
    });

    it('should report caughtUp only on the page that ends the delta chain', async () => {

        stubPages(3);
        const caughtUp = [];

        await scan({
            saveProgress: async (link, { caughtUp: done }) => {
                caughtUp.push(done);
                await context.stateSet('deltaLink', link);
            }
        });

        assert.deepStrictEqual(caughtUp, [false, false, true]);
        assert.ok(context.stateSet.calledWith(delta.SKIPPED_FLAG, false));
    });

    it('should clear the skipped flag up front so a concurrent skip is not overwritten', async () => {

        stubPages(2);

        await scan();

        const flagWrites = context.stateSet.getCalls()
            .filter(call => call.args[0] === delta.SKIPPED_FLAG)
            .map(call => call.args[1]);
        // Exactly one write, and it is the very first state write, before any Graph call - a
        // run that gets skipped while we are paging must be able to leave its own `true`
        // behind, which a trailing clear would have overwritten.
        assert.deepStrictEqual(flagWrites, [false]);
        assert.strictEqual(context.stateSet.getCall(0).args[0], delta.SKIPPED_FLAG);
        assert.ok(context.stateSet.getCall(0).calledBefore(getStub.getCall(0)));
    });

    it('should log loudly when a page carries neither a next nor a delta link', async () => {

        getStub = sandbox.stub(commons, 'get').resolves({ value: [{ id: 'orphan' }] });

        await scan();

        assert.ok(context.log.calledWithMatch({ step: 'delta-no-resume-link' }));
        assert.deepStrictEqual(savedLinks(), []);
    });

    it('should extend the lock before every page with a realistic TTL', async () => {

        stubPages(3);

        await scan();

        assert.strictEqual(lock.extend.callCount, 3);
        lock.extend.getCalls().forEach(call => assert.strictEqual(call.args[0], delta.LOCK_TTL));
    });

    it('should stop at the page cap and flag the rest of the backlog for the next tick', async () => {

        stubPages(1000);

        await scan();

        assert.strictEqual(getStub.callCount, delta.MAX_PAGES_PER_RUN);
        assert.strictEqual(savedLinks().pop(), `p${delta.MAX_PAGES_PER_RUN}`);
        assert.ok(context.stateSet.calledWith(delta.SKIPPED_FLAG, true));
        assert.strictEqual(lock.unlock.callCount, 1);
    });

    it('should abort instead of paging on unprotected when the lock cannot be extended', async () => {

        stubPages(1000);
        lock.extend.onCall(1).rejects(new Error('lock expired'));

        await scan();

        assert.strictEqual(getStub.callCount, 1);
        assert.ok(context.log.calledWithMatch({ step: 'lock-lost' }));
        assert.ok(context.stateSet.calledWith(delta.SKIPPED_FLAG, true));
        assert.strictEqual(lock.unlock.callCount, 1);
    });

    it('should skip the run and ask tick() to come back when the lock is already held', async () => {

        stubPages(1);
        context.lock.rejects(new Error('Exceeded 0 attempts to lock the resource'));

        await scan();

        assert.strictEqual(getStub.callCount, 0);
        assert.ok(context.log.calledWithMatch({ step: 'delta-scan-skipped' }));
        assert.ok(context.stateSet.calledWith(delta.SKIPPED_FLAG, true));
    });

    it('should not let an unlock failure mask the outcome', async () => {

        stubPages(1);
        lock.unlock.rejects(new Error('lock already released'));

        await scan();

        assert.ok(context.log.calledWithMatch({ step: 'unlock-failed' }));
        assert.strictEqual(context.sendJson.callCount, 1);
    });

    it('should release the lock and propagate a real Graph failure', async () => {

        sandbox.stub(commons, 'get').rejects(new Error('500 - Graph exploded'));

        await assert.rejects(() => scan(), /Graph exploded/);
        assert.strictEqual(lock.unlock.callCount, 1);
    });

    it('should do nothing when there is no link to resume from', async () => {

        stubPages(1);
        context.loadState.resolves({});

        await scan();

        assert.strictEqual(getStub.callCount, 0);
        assert.strictEqual(lock.unlock.callCount, 1);
    });
});

describe('microsoft-delta withComponentLock', () => {

    let sandbox;
    let context;
    let lock;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        lock = { extend: sandbox.stub().resolves(), unlock: sandbox.stub().resolves() };
        context = {
            componentId: 'test-component',
            lock: sandbox.stub().resolves(lock),
            log: sandbox.stub().resolves()
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should skip the work instead of storming a contended lock', async () => {

        context.lock.rejects(new Error('Exceeded 30 attempts to lock the resource'));
        const fn = sandbox.stub().resolves();

        const ran = await delta.withComponentLock(context, { step: 'webhook-renewal-skipped' }, fn);

        assert.strictEqual(ran, false);
        assert.strictEqual(fn.callCount, 0);
        assert.deepStrictEqual(context.lock.firstCall.args[1], { maxRetryCount: 0, ttl: delta.LOCK_TTL });
        assert.ok(context.log.calledWithMatch({ step: 'webhook-renewal-skipped' }));
    });

    it('should run the work and always release the lock', async () => {

        const ran = await delta.withComponentLock(context, {}, async () => {});

        assert.strictEqual(ran, true);
        assert.strictEqual(lock.unlock.callCount, 1);
    });

    it('should release the lock when the work throws', async () => {

        await assert.rejects(
            () => delta.withComponentLock(context, {}, async () => {
                throw new Error('renewal failed');
            }),
            /renewal failed/);

        assert.strictEqual(lock.unlock.callCount, 1);
    });
});

describe('microsoft-delta baseline & eager fetching', () => {

    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should ask for the latest delta token instead of enumerating the drive', async () => {

        const getStub = sandbox.stub(commons, 'get').resolves({ value: [], '@odata.deltaLink': 'link' });

        const deltaLink = await delta.fetchLatestDeltaLink('/drives/d1/items/root/delta', 'token');

        assert.strictEqual(deltaLink, 'link');
        assert.strictEqual(getStub.callCount, 1);
        assert.strictEqual(getStub.firstCall.args[0], '/drives/d1/items/root/delta?token=latest');
    });

    it('should keep an existing query string when adding token=latest', async () => {

        const getStub = sandbox.stub(commons, 'get').resolves({ '@odata.deltaLink': 'link' });

        await delta.fetchLatestDeltaLink('/drives/d1/items/root/delta?select=id', 'token');

        assert.strictEqual(getStub.firstCall.args[0], '/drives/d1/items/root/delta?select=id&token=latest');
    });

    it('should fail loudly when Graph returns no baseline delta link', async () => {

        sandbox.stub(commons, 'get').resolves({ value: [] });

        await assert.rejects(
            () => delta.fetchLatestDeltaLink('/drives/d1/items/root/delta', 'token'),
            /did not return a delta link/);
    });

    it('should cap the eager fetch used by start()/test() as well', async () => {

        const getStub = sandbox.stub(commons, 'get').callsFake(async (link) => ({
            value: [{ id: link }],
            '@odata.nextLink': `${link}+`
        }));

        const { items } = await delta.fetchDeltaPages('/delta', 'token');

        assert.strictEqual(getStub.callCount, delta.MAX_PAGES_PER_RUN);
        assert.strictEqual(items.length, delta.MAX_PAGES_PER_RUN);
    });

    it('should honour an explicit page cap, as Flow Test Mode needs', async () => {

        const getStub = sandbox.stub(commons, 'get').callsFake(async (link) => ({
            value: [{ id: link }],
            '@odata.nextLink': `${link}+`
        }));

        await delta.fetchDeltaPages('/delta', 'token', { maxPages: delta.TEST_MODE_MAX_PAGES });

        assert.ok(delta.TEST_MODE_MAX_PAGES > delta.MAX_PAGES_PER_RUN);
        assert.strictEqual(getStub.callCount, delta.TEST_MODE_MAX_PAGES);
    });

    it('should concatenate the items of every page it walked', async () => {

        sandbox.stub(commons, 'get')
            .onCall(0).resolves({ value: [{ id: 'a' }], '@odata.nextLink': 'p1' })
            .onCall(1).resolves({ value: [{ id: 'b' }], '@odata.deltaLink': 'd' });

        const { items, deltaLink } = await delta.fetchDeltaPages('/delta', 'token');

        assert.deepStrictEqual(items.map(i => i.id), ['a', 'b']);
        assert.strictEqual(deltaLink, 'd');
    });
});

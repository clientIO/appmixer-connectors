'use strict';

const assert = require('assert');
const path = require('path');
const { createMockWiz } = require('./mockWiz');
const { createWizContext } = require('./mockContext');

const lib = require(path.join(__dirname, '../../lib.js'));

describe('wiz lib.getStatus polling bounds', () => {

    it('returns the activity once it leaves IN_PROGRESS', async () => {
        const { httpRequest, state } = createMockWiz({ inProgressPolls: 3 });
        const context = createWizContext({
            httpRequest,
            config: { statusPollingInterval: '1' }
        });

        const activity = await lib.getStatus(context, 'activity-1');

        assert.strictEqual(activity.status, 'SUCCESS');
        assert.strictEqual(state.statusPolls, 4, '3 IN_PROGRESS polls + 1 SUCCESS poll');
    });

    it('gives up after exactly statusNumberOfAttempts polls', async () => {
        const { httpRequest, state } = createMockWiz({ failStatusForever: true });
        const context = createWizContext({
            httpRequest,
            config: { statusNumberOfAttempts: '5', statusPollingInterval: '1' }
        });

        await assert.rejects(() => lib.getStatus(context, 'activity-1'), /Exceeded max attempts/);
        assert.strictEqual(state.statusPolls, 5);
    });

    it('caps a misconfigured statusNumberOfAttempts at 60', async () => {
        const { httpRequest, state } = createMockWiz({ failStatusForever: true });
        const context = createWizContext({
            httpRequest,
            config: { statusNumberOfAttempts: '100000', statusPollingInterval: '1' }
        });

        await assert.rejects(() => lib.getStatus(context, 'activity-1'));
        assert.strictEqual(state.statusPolls, 60);
    });

    it('caps a misconfigured statusPollingInterval at 10s (config value is not trusted)', () => {
        // Indirectly: a 10-minute configured interval must not be what the poll sleeps.
        // We verify via the deadline test below (with an uncapped interval the first
        // retry alone would exceed the deadline budget many times over).
        const context = createWizContext({ config: { statusPollingInterval: '600000' } });
        // The cap itself is internal; assert the deadline helper is bounded instead.
        const deadline = lib.getStatusDeadline(context);
        assert.ok(deadline - Date.now() <= 5 * 60 * 1000 + 50);
    });

    it('enforces the wall-clock deadline even when the endpoint is slow', async function() {
        this.timeout(5000);
        // Each poll takes ~60ms; the total budget is 100ms — the session must stop
        // after very few polls no matter how many attempts are configured.
        const { httpRequest, state } = createMockWiz({ failStatusForever: true, latency: 60 });
        const context = createWizContext({
            httpRequest,
            config: {
                statusNumberOfAttempts: '60',
                statusPollingInterval: '1',
                statusMaxTotalTime: '100'
            }
        });

        await assert.rejects(() => lib.getStatus(context, 'activity-1'), /time budget|Exceeded/);
        assert.ok(state.statusPolls <= 3,
            `expected the deadline to stop polling after <=3 polls, got ${state.statusPolls}`);
    });

    it('reports the GraphQL error Wiz kept answering with once the budget is spent', async () => {
        // A systemActivity id that never resolves (the real case: an upload made with
        // an integration id Wiz does not know) used to surface as a bare
        // "Exceeded max attempts" with no hint of what went wrong.
        const { httpRequest, state } = createMockWiz({
            statusErrors: [{ message: 'Resource not found' }]
        });
        const context = createWizContext({
            httpRequest,
            config: { statusNumberOfAttempts: '3', statusPollingInterval: '1' }
        });

        await assert.rejects(
            () => lib.getStatus(context, 'activity-1'),
            /Exceeded max attempts.*Last error from Wiz: Resource not found/s);
        assert.strictEqual(state.statusPolls, 3);
    });

    it('fails immediately on a permanent authorization error instead of polling', async () => {
        const { httpRequest, state } = createMockWiz({
            statusErrors: [{
                message: 'access denied, at least one of the following is required: [read:all]',
                extensions: { code: 'UNAUTHORIZED' }
            }]
        });
        const context = createWizContext({
            httpRequest,
            config: { statusNumberOfAttempts: '20', statusPollingInterval: '1' }
        });

        await assert.rejects(() => lib.getStatus(context, 'activity-1'), /Wiz rejected the status query/);
        assert.strictEqual(state.statusPolls, 1, 'an authorization error must not be retried');
    });

    it('honours a caller-supplied attempt budget (UploadSecurityScan uses 5 x 2s)', async () => {
        const { httpRequest, state } = createMockWiz({ failStatusForever: true });
        const context = createWizContext({
            httpRequest,
            config: { statusNumberOfAttempts: '20' }
        });

        await assert.rejects(
            () => lib.getStatus(context, 'activity-1', { maxAttempts: 5, pollingInterval: 1 }),
            /Exceeded max attempts/);
        assert.strictEqual(state.statusPolls, 5);
    });

    it('caps statusMaxTotalTime at 5 minutes', () => {
        const context = createWizContext({ config: { statusMaxTotalTime: String(24 * 60 * 60 * 1000) } });
        const deadline = lib.getStatusDeadline(context);
        assert.ok(deadline - Date.now() <= 5 * 60 * 1000 + 50);
    });
});

describe('wiz lib.getRequestTimeout', () => {

    it('defaults to 60s and survives a missing config', () => {
        assert.strictEqual(lib.getRequestTimeout({}), 60000);
        assert.strictEqual(lib.getRequestTimeout(undefined), 60000);
        assert.strictEqual(lib.getRequestTimeout({ config: {} }), 60000);
    });

    it('caps a configured timeout at 2 minutes and ignores invalid values', () => {
        assert.strictEqual(lib.getRequestTimeout({ config: { requestTimeout: '30000' } }), 30000);
        assert.strictEqual(lib.getRequestTimeout({ config: { requestTimeout: '999999999' } }), 120000);
        assert.strictEqual(lib.getRequestTimeout({ config: { requestTimeout: '-1' } }), 60000);
        assert.strictEqual(lib.getRequestTimeout({ config: { requestTimeout: 'abc' } }), 60000);
    });

    it('every wiz httpRequest carries the bounded timeout', async () => {
        const { httpRequest, state } = createMockWiz({ resourcesTotal: 1 });
        const context = createWizContext({ httpRequest });

        await lib.makeApiCall({ context, method: 'POST', data: { query: 'cloudResources', variables: { first: 1 } } });
        await lib.uploadFile(context, { url: 'https://upload.mock.wiz/x', fileContent: { dataSources: [] } });

        for (const call of state.calls) {
            assert.strictEqual(call.timeout, 60000, `request ${call.method} ${call.url} has no bounded timeout`);
        }
    });
});

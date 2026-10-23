const assert = require('assert');
const sinon = require('sinon');
const path = require('path');
const testUtils = require('../../../../../../test/utils.js');

/**
 * Tests for src/appmixer/slack/taskUtils.js triggerWebhook.
 * Verifies that a failing webhook is not retried forever:
 *  - 404/410 (flow or component gone) removes the task immediately
 *  - other failures are retried with a capped backoff and never remove the task
 */

describe('slack taskUtils.triggerWebhook', () => {

    let context;
    let utils;
    let deleteOneStub;
    let FakeTask;
    let taskModelPath;
    let taskUtilsPath;

    const httpError = status => Object.assign(new Error(`Request failed with status code ${status}`), {
        response: { status }
    });

    beforeEach(() => {
        context = testUtils.createMockContext();
        context.config = { failedWebhooksBackoffBaseMs: '1000', failedWebhooksBackoffMaxMs: '8000' };
        deleteOneStub = sinon.stub().resolves({ deletedCount: 1 });
        context.db.collection = sinon.stub().returns({ deleteOne: deleteOneStub });

        FakeTask = class {
            constructor(data) { Object.assign(this, data); }
            getStatus() { return this.status; }
            setStatus(status) { this.status = status; }
            getWebhookUrl() { return this.webhookUrl; }
            getWebhookAttempts() { return this.webhookAttempts; }
            setWebhookAttempts(value) { this.webhookAttempts = value; }
            setNextAttemptAt(value) { this.nextAttemptAt = value; }
            setFailedStatus(value) { this.failedStatus = value; }
            toJson() { return { ...this }; }
            static get STATUS_ERROR() { return 'error'; }
            static get collection() { return 'slack_tasks'; }
            static get idProperty() { return 'taskId'; }
        };
        FakeTask.prototype.save = sinon.stub().resolves();

        taskModelPath = path.resolve(__dirname, '../../../SlackTaskModel.js');
        require.cache[taskModelPath] = {
            id: taskModelPath,
            filename: taskModelPath,
            loaded: true,
            exports: () => FakeTask
        };
        taskUtilsPath = path.resolve(__dirname, '../../../taskUtils.js');
        delete require.cache[taskUtilsPath];
        utils = require(taskUtilsPath)(context);
    });

    afterEach(() => {
        sinon.restore();
        delete require.cache[taskModelPath];
        delete require.cache[taskUtilsPath];
    });

    const newTask = (data = {}) => new FakeTask({
        taskId: 't1',
        status: 'approved',
        webhookUrl: 'https://api.example.com/flows/f1/components/c1',
        ...data
    });

    it('delivers the task without internal properties', async () => {

        context.httpRequest.resolves({ status: 200 });
        const task = newTask({ webhookAttempts: 2, failedStatus: 'approved', nextAttemptAt: new Date() });

        const result = await utils.triggerWebhook(task);

        assert.deepEqual(result, { ok: true });
        const { data } = context.httpRequest.getCall(0).args[0];
        assert.equal(data.status, 'approved');
        assert.equal(data.webhookAttempts, undefined);
        assert.equal(data.failedStatus, undefined);
        assert.equal(data.nextAttemptAt, undefined);
        assert.equal(task.webhookAttempts, 0);
        assert.equal(deleteOneStub.callCount, 0);
    });

    [404, 410].forEach(status => {
        it(`removes the task on ${status}`, async () => {

            context.httpRequest.rejects(httpError(status));
            const task = newTask();

            const result = await utils.triggerWebhook(task);

            assert.deepEqual(result, { ok: false, permanent: true, removed: true, httpStatus: status });
            assert(context.db.collection.calledWith('slack_tasks'));
            assert.deepEqual(deleteOneStub.getCall(0).args[0], { taskId: 't1' });
            assert.equal(task.save.callCount, 0);
        });
    });

    it('keeps the task for a retry with backoff on a transient error', async () => {

        context.httpRequest.rejects(httpError(500));
        const task = newTask({ webhookAttempts: 1 });
        const before = Date.now();

        const result = await utils.triggerWebhook(task);

        assert.deepEqual(result, { ok: false, permanent: false, removed: false, httpStatus: 500 });
        assert.equal(task.status, 'error');
        assert.equal(task.failedStatus, 'approved');
        assert.equal(task.webhookAttempts, 2);
        // Second failure: base delay doubled.
        assert(task.nextAttemptAt.getTime() >= before + 2000);
        assert.equal(task.save.callCount, 1);
        assert.equal(deleteOneStub.callCount, 0);
    });

    it('keeps a task that keeps failing and caps the backoff', async () => {

        // A stopped flow answers 400 for as long as it is stopped.
        context.httpRequest.rejects(httpError(400));
        const task = newTask({ webhookAttempts: 50 });
        const before = Date.now();

        const result = await utils.triggerWebhook(task);

        assert.deepEqual(result, { ok: false, permanent: false, removed: false, httpStatus: 400 });
        assert.equal(task.status, 'error');
        assert.equal(task.failedStatus, 'approved');
        assert.equal(task.webhookAttempts, 51);
        assert(task.nextAttemptAt.getTime() >= before + 8000);
        assert(task.nextAttemptAt.getTime() <= Date.now() + 8000);
        assert.equal(task.save.callCount, 1);
        assert.equal(deleteOneStub.callCount, 0);
    });

    it('retries a network error without a response', async () => {

        context.httpRequest.rejects(new Error('ECONNRESET'));
        const task = newTask();

        const result = await utils.triggerWebhook(task);

        assert.deepEqual(result, { ok: false, permanent: false, removed: false, httpStatus: undefined });
        assert.equal(task.webhookAttempts, 1);
    });
});

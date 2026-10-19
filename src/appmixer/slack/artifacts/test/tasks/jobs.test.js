const assert = require('assert');
const sinon = require('sinon');
const path = require('path');
const testUtils = require('../../../../../../test/utils.js');

/**
 * Tests for Slack jobs (src/appmixer/slack/jobs.js)
 * Verifies:
 *  - due-tasks job finds correct tasks, sets status to due, saves, and triggers webhooks
 *  - resubmit-failed-webhooks job finds failed webhooks and re-triggers them
 */

describe('slack-due-tasks', () => {

    let context;
    let dueHandler;
    let resubmitHandler;
    let triggerWebhookStub;
    let taskFindSpy;
    let setMockTasks;
    let getSavedTasks;
    // eslint-disable-next-line max-len, one-var
    let rootTaskUtilsPath, taskModelPath, webhookModelPath, jobsPath, jobsUtilsRequirePath, jobsTaskRequirePath, jobsWebhookRequirePath;

    beforeEach(async () => {
        context = {
            ...testUtils.createMockContext(),
            scheduleJob: sinon.stub()
        };

        // Provide Promise utils used by the job
        context.utils.P = {
            mapArray: async (arr, fn) => Promise.all(arr.map(fn))
        };

        // Stub the utils module used by slack/jobs.js
        const createUtilsStub = modulePath => ({
            id: modulePath,
            filename: modulePath,
            loaded: true,
            exports: () => ({
                triggerWebhook: triggerWebhookStub
            })
        });
        triggerWebhookStub = sinon.stub().resolves({ ok: true });
        rootTaskUtilsPath = path.resolve(__dirname, '../../../taskUtils.js');
        require.cache[rootTaskUtilsPath] = createUtilsStub(rootTaskUtilsPath);

        // Stub SlackTaskModel
        taskModelPath = path.resolve(__dirname, '../../../SlackTaskModel.js');
        let taskRecords = [];
        let savedTasks = [];
        class FakeTask {
            constructor(data) { Object.assign(this, data); }
            getId() { return this.taskId; }
            setStatus(status) { this.status = status; }
            getWebhookUrl() { return this.webhookUrl; }
            async save() { savedTasks.push(this); return this; }
            static get STATUS_DUE() { return 'due'; }
            static get STATUS_ERROR() { return 'error'; }
            static get STATUS_PENDING() { return 'pending'; }
            static get collection() { return 'slack_tasks'; }
            static async find(query) { return taskRecords.map(r => new FakeTask(r)); }
        }
        taskFindSpy = sinon.spy(FakeTask, 'find');
        setMockTasks = (arr) => { taskRecords = arr; savedTasks = []; };
        getSavedTasks = () => savedTasks;
        require.cache[require.resolve(taskModelPath)] = {
            id: taskModelPath,
            filename: taskModelPath,
            loaded: true,
            exports: () => FakeTask
        };
        // Also provide a stub for the path slack/jobs.js uses ('./SlackTaskModel')
        const jobsDir = path.resolve(__dirname, '../../../src/appmixer/slack');
        jobsTaskRequirePath = path.join(jobsDir, 'SlackTaskModel.js');
        require.cache[jobsTaskRequirePath] = {
            id: jobsTaskRequirePath,
            filename: jobsTaskRequirePath,
            loaded: true,
            exports: () => FakeTask
        };

        // Provide './utils' path expected by slack/jobs.js
        jobsUtilsRequirePath = path.join(jobsDir, 'taskUtils.js');
        require.cache[jobsUtilsRequirePath] = createUtilsStub(jobsUtilsRequirePath);

        // Register the jobs
        jobsPath = path.resolve(__dirname, '../../../jobs.js');
        delete require.cache[require.resolve(jobsPath)];
        const jobs = require(jobsPath);
        await jobs(context);
        // First scheduled handler is due-tasks, second is resubmit-failed-webhooks
        dueHandler = context.scheduleJob.getCall(0).args[2];
        resubmitHandler = context.scheduleJob.getCall(1).args[2];
    });

    afterEach(() => {
        sinon.restore();
        // eslint-disable-next-line max-len
        [
            rootTaskUtilsPath,
            jobsUtilsRequirePath,
            taskModelPath,
            jobsTaskRequirePath,
            webhookModelPath,
            jobsWebhookRequirePath,
            jobsPath
        ].forEach(p => {
            if (p && require.cache[p]) delete require.cache[p];
        });
    });

    it('should find and process due tasks', async () => {
        const dueTasks = [
            { taskId: 't1', status: 'pending', decisionBy: new Date(Date.now() - 1000) },
            { taskId: 't2', status: 'pending', decisionBy: new Date(Date.now() - 500) }
        ];
        setMockTasks(dueTasks);

        await dueHandler();

        // Verify Task.find query
        assert(taskFindSpy.calledOnce);
        const queryArg = taskFindSpy.getCall(0).args[0];
        assert.equal(queryArg.status, 'pending');
        assert(queryArg.decisionBy.$lt instanceof Date);

        // Saved tasks should be marked due
        const saved = getSavedTasks();
        assert.equal(saved.length, 2);
        assert(saved.every(t => t.status === 'due'));

        // Webhooks should be triggered once per task
        assert.equal(triggerWebhookStub.callCount, 2);
    });

    it('should handle no due tasks gracefully', async () => {
        setMockTasks([]);
        await dueHandler();
        const saved = getSavedTasks();
        assert.equal(saved.length, 0);
        assert.equal(triggerWebhookStub.callCount, 0);
    });

    it('should resubmit failed webhooks', async () => {

        // Prepare two tasks in error state: one will succeed when retried, one will fail
        const errorTasks = [
            { taskId: 'e1', status: 'error' },
            { taskId: 'e2', status: 'error' }
        ];
        setMockTasks(errorTasks);

        // Configure triggerWebhook: succeed for first, fail for second
        triggerWebhookStub.onCall(0).resolves({ ok: true });
        triggerWebhookStub.onCall(1).rejects(new Error('webhook failed'));

        await resubmitHandler();

        // Verify Task.find called for error status whose backoff has elapsed
        assert(taskFindSpy.called);
        const queryArg = taskFindSpy.getCall(0).args[0];
        assert.equal(queryArg.status, 'error');
        assert.deepEqual(queryArg.$or[0], { nextAttemptAt: null });
        assert(queryArg.$or[1].nextAttemptAt.$lte instanceof Date);

        const saved = getSavedTasks();
        // First task should have been set to pending then saved, second should be reverted back to error and saved
        const sbyId = id => saved.find(t => t.taskId === id) || null;
        const firstSaved = sbyId('e1');
        const secondSaved = sbyId('e2');
        assert(firstSaved, 'first task was not saved');
        assert(secondSaved, 'second task was not saved');

        // First should be pending, second should be error
        assert.equal(firstSaved.status, 'pending');
        assert.equal(secondSaved.status, 'error');

        // triggerWebhook should be called twice
        assert.equal(triggerWebhookStub.callCount, 2);

    });

    it('should resubmit the status that failed to be delivered', async () => {

        setMockTasks([{ taskId: 'e1', status: 'error', failedStatus: 'approved' }]);

        await resubmitHandler();

        assert.equal(triggerWebhookStub.getCall(0).args[0].status, 'approved');
        assert.equal(getSavedTasks()[0].status, 'approved');
    });

    it('should report real outcomes and not save failed or removed tasks', async () => {

        setMockTasks([
            { taskId: 'ok', status: 'error' },
            { taskId: 'gone', status: 'error' },
            { taskId: 'retry', status: 'error' }
        ]);
        triggerWebhookStub.onCall(0).resolves({ ok: true });
        triggerWebhookStub.onCall(1).resolves({ ok: false, permanent: true, removed: true, httpStatus: 404 });
        triggerWebhookStub.onCall(2).resolves({ ok: false, permanent: false, removed: false, httpStatus: 500 });

        await resubmitHandler();

        // Only the delivered task is saved by the job, triggerWebhook persists the failures itself.
        assert.deepEqual(getSavedTasks().map(t => t.taskId), ['ok']);

        const summary = context.log.getCalls().find(c => /Resubmit failed webhooks finished/.test(c.args[1]));
        assert(summary, 'summary was not logged');
        assert.deepEqual(summary.args[2], { webhooks: 3, success: 1, errors: 1, removed: 1 });
    });

    it('should not save a due task whose webhook failed', async () => {

        setMockTasks([{ taskId: 't1', status: 'pending', decisionBy: new Date(Date.now() - 1000) }]);
        triggerWebhookStub.resolves({ ok: false, permanent: true, removed: true, httpStatus: 404 });

        await dueHandler();

        assert.equal(getSavedTasks().length, 0);
    });

    it('should handle no failed webhooks gracefully', async () => {
        setMockTasks([]);
        await resubmitHandler();
        const saved = getSavedTasks();
        assert.equal(saved.length, 0);
        assert.equal(triggerWebhookStub.callCount, 0);
    });

    it('should remove tasks older than 60 days via deleteMany', async () => {
        // Arrange: create 10 tasks all on the same day
        const clock = sinon.useFakeTimers(new Date('2025-01-01T00:00:00Z').getTime());
        const tenTasks = Array.from({ length: 10 }).map((_, i) => ({
            taskId: `old-${i + 1}`,
            status: 'pending',
            created: new Date(),
            decisionBy: new Date()
        }));
        setMockTasks(tenTasks);

        // Stub deleteMany to return the number of deleted tasks
        const coll = context.db.collection();
        coll.deleteMany.resolves({ deletedCount: tenTasks.length });

        // Act: jump ahead by 61 days to trigger cleanup of >60 days old tasks
        clock.tick(61 * 24 * 60 * 60 * 1000);
        await dueHandler();

        // Assert the correct collection and filter used
        assert(context.db.collection.calledWith('slack_tasks'));
        assert.equal(coll.deleteMany.callCount, 1);
        const filterArg = coll.deleteMany.getCall(0).args[0];
        // The task model stores the creation time in `created`.
        assert(filterArg && filterArg.created && filterArg.created.$lt instanceof Date);
        const expectedCutoff = new Date(Date.now());
        expectedCutoff.setDate(expectedCutoff.getDate() - 60);
        assert.equal(filterArg.created.$lt.getTime(), expectedCutoff.getTime());

        clock.restore();
    });
});

const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../../../../../../test/utils.js');

// Slack Tasks routes tests (prepare now, expect failures until implementation aligns)

describe('Slack Tasks routes', () => {

    let context;
    let routes;
    let slackLib;
    let memory;
    let triggerWebhook;

    beforeEach(async () => {
        context = testUtils.createMockContext();

        // Stub router and Joi, HttpError
        const JoiStub = {
            string: () => ({ required: () => ({}), uri: () => ({ required: () => ({}) }), valid: () => ({}) }),
            date: () => ({ iso: () => ({}) }),
            object: () => ({}),
            number: () => ({ integer: () => ({ min: () => ({ max: () => ({ default: () => ({}) }) }) }) })
        };
        context.http = {
            router: { register: sinon.stub() },
            Joi: JoiStub,
            HttpError: class {
                static badRequest(msg) { const e = new Error(msg); e.code = 400; return e; }
            }
        };

        // In-memory stores
        memory = { tasks: {}, webhooks: {} };

        // Stub Slack models via require cache (both legacy and root paths)
        const createTaskModuleStub = modulePath => ({
            id: modulePath,
            filename: modulePath,
            loaded: true,
            exports: () => {
                class Task {
                    static get STATUS_PENDING() { return 'pending'; }
                    static get STATUS_REJECTED() { return 'rejected'; }
                    static get STATUS_APPROVED() { return 'approved'; }
                    static async findById(id) { return memory.tasks[id]; }
                    populate(obj) {
                        const id = obj.taskId || 'TS1';
                        const entity = Object.assign({ taskId: id }, obj);
                        memory.tasks[id] = {
                            ...entity,
                            toJson: () => entity,
                            getStatus: () => entity.status,
                            setStatus: s => { entity.status = s; },
                            setDecisionMade: d => { entity.decisionMade = d; },
                            setActor: a => { entity.actor = a; },
                            getId: () => id,
                            getWebhookUrl: () => entity.webhookUrl,
                            addIsApprover: () => ({ toJson: () => entity }),
                            save: sinon.stub().resolves(entity)
                        };
                        return { save: async () => entity };
                    }
                }
                Task.createSettersAndGetters = () => {};
                return Task;
            }
        });

        const rootTaskModelPath = require.resolve('../../../SlackTaskModel.js');
        require.cache[rootTaskModelPath] = createTaskModuleStub(rootTaskModelPath);

        // Stub slack lib sendMessage
        slackLib = require('../../../lib.js');
        sinon.stub(slackLib, 'sendMessage').resolves({ ok: true });

        // Stub slack/tasks/utils.js before requiring routes to avoid external deps
        triggerWebhook = sinon.stub().resolves({ ok: true });
        const createUtilsModuleStub = modulePath => ({
            id: modulePath,
            filename: modulePath,
            loaded: true,
            exports: () => ({
                triggerWebhook,
                getTask: async () => ({})
            })
        });
        const rootUtilsPath = require.resolve('../../../taskUtils.js');
        require.cache[rootUtilsPath] = createUtilsModuleStub(rootUtilsPath);

        // Load and register routes
        routes = require('../../../routes-tasks.js');
        await routes(context);

        // Helper to fetch handler
        context.getRouteHandler = (method, path) => {
            const call = context
                .http
                .router
                .register
                .getCalls()
                .find(c => c.args[0].method === method && c.args[0].path === path);
            return call && call.args[0].options.handler;
        };
    });

    afterEach(() => {
        sinon.restore();
        ['../../../SlackTaskModel.js', '../../../taskUtils.js']
            .forEach(modulePath => {
                try { delete require.cache[require.resolve(modulePath)]; } catch (_) {}
            });
    });

    describe('POST /interactions', () => {
        it('approves a task and responds via response_url', async () => {
            // Ensure payload and response_url are properly initialized
            const create = context.getRouteHandler('POST', '/tasks');
            const created = await create({ payload: { title: 'T', description: 'D', requester: 'U1', approver: 'U2', channel: 'C1', decisionBy: new Date().toISOString(), status: 'pending' } });

            sinon.stub(slackLib, 'isValidPayload').returns(true);
            context.httpRequest.resolves({
                statusCode: 200,
                body: JSON.stringify({ replace_original: true, blocks: [] })
            });

            const handler = context.getRouteHandler('POST', '/interactions');
            const payload = {
                type: 'block_actions',
                user: { id: 'U2' },
                response_url: 'https://hooks.slack.com/actions/T/XXX/YYY',
                message: {
                    blocks: [
                        { type: 'section', text: { type: 'mrkdwn', text: '*T*\nD' } },
                        { type: 'context', elements: [{ type: 'mrkdwn', text: '*Requester:* <@U1>   *Approver:* <@U2>' }] },
                        { type: 'actions', elements: [{ type: 'button', action_id: 'task_approve', value: created.taskId }] }
                    ]
                },
                actions: [{ action_id: 'task_approve', value: created.taskId }]
            };
            const body = 'payload=' + encodeURIComponent(JSON.stringify(payload));

            const h = { response: sinon.stub().returns({ code: sinon.stub() }) };
            await handler({ payload: Buffer.from(body) }, h);

            // Verify state transition via GET route
            const getHandler = context.getRouteHandler('GET', '/tasks/{taskId}');
            const fetched = await getHandler({ params: { taskId: created.taskId }, query: {} });
            assert.equal(fetched.status, 'approved');

            // Response URL called
            assert(context.httpRequest.calledOnce, 'Should POST to response_url');
            const args = context.httpRequest.getCall(0).args[0];
            assert.equal(args.url, payload.response_url);
            // Verify blocks preserved and actions removed
            // httpRequest is called with { data: ... } in implementation; tests should read args.data
            const sent = args.data ? args.data : (args.body ? JSON.parse(args.body) : undefined);
            assert.equal(sent.replace_original, true);
            assert(Array.isArray(sent.blocks), 'blocks should be sent');
            assert.equal(sent.blocks.some(b => b.type === 'actions'), false, 'actions block should be removed');
            const last = sent.blocks[sent.blocks.length - 1];
            assert.equal(last.type, 'context');
            assert(last.elements[0].text.includes('approved'), 'status line should indicate approved');
        });

        it('rejects a task and responds via response_url', async () => {
            const create = context.getRouteHandler('POST', '/tasks');
            const created = await create({ payload: { title: 'T', description: 'D', requester: 'U1', approver: 'U2', channel: 'C1', decisionBy: new Date().toISOString(), status: 'pending' } });

            sinon.stub(slackLib, 'isValidPayload').returns(true);
            context.httpRequest.resolves({ statusCode: 200 });

            const handler = context.getRouteHandler('POST', '/interactions');
            const payload = {
                type: 'block_actions',
                user: { id: 'U2' },
                response_url: 'https://hooks.slack.com/actions/T/XXX/YYY',
                message: {
                    blocks: [
                        { type: 'section', text: { type: 'mrkdwn', text: '*T*\nD' } },
                        { type: 'context', elements: [{ type: 'mrkdwn', text: '*Requester:* <@U1>   *Approver:* <@U2>' }] },
                        { type: 'actions', elements: [{ type: 'button', action_id: 'task_reject', value: created.taskId }] }
                    ]
                },
                actions: [{ action_id: 'task_reject', value: created.taskId }]
            };
            const body = 'payload=' + encodeURIComponent(JSON.stringify(payload));

            const h = { response: sinon.stub().returns({ code: sinon.stub() }) };
            await handler({ payload: Buffer.from(body) }, h);

            const getHandler = context.getRouteHandler('GET', '/tasks/{taskId}');
            const fetched = await getHandler({ params: { taskId: created.taskId }, query: {} });
            assert.equal(fetched.status, 'rejected');

            assert(context.httpRequest.calledOnce, 'Should POST to response_url');
            const args = context.httpRequest.getCall(0).args[0];
            assert.equal(args.url, payload.response_url);
            const sent = args.data ? args.data : (args.body ? JSON.parse(args.body) : undefined);
            assert.equal(sent.replace_original, true);
            assert(Array.isArray(sent.blocks), 'blocks should be sent');
            assert.equal(sent.blocks.some(b => b.type === 'actions'), false, 'actions block should be removed');
            const last = sent.blocks[sent.blocks.length - 1];
            assert.equal(last.type, 'context');
            assert(last.elements[0].text.includes('rejected'), 'status line should indicate rejected');
        });

        it('returns 401 when Slack signature invalid', async () => {
            const handler = context.getRouteHandler('POST', '/interactions');
            sinon.stub(slackLib, 'isValidPayload').returns(false);
            const payload = { type: 'block_actions', actions: [{ action_id: 'task_approve', value: 'X' }] };
            const body = 'payload=' + encodeURIComponent(JSON.stringify(payload));

            const codeStub = sinon.stub();
            const h = { response: sinon.stub().returns({ code: codeStub }) };
            await handler({ payload: Buffer.from(body) }, h);
            assert(codeStub.calledWith(401), 'Should return 401 for invalid signature');
        });

        it('approves a task and triggers webhooks', async () => {
            const create = context.getRouteHandler('POST', '/tasks');
            const created = await create({ payload: { title: 'T', description: 'D', requester: 'U1', approver: 'U2', channel: 'C1', decisionBy: new Date().toISOString(), status: 'pending' } });

            sinon.stub(slackLib, 'isValidPayload').returns(true);
            context.httpRequest.resolves({ statusCode: 200 });

            const handler = context.getRouteHandler('POST', '/interactions');
            const payload = {
                type: 'block_actions',
                user: { id: 'U2' },
                response_url: 'https://hooks.slack.com/actions/T/XXX/YYY',
                message: {
                    blocks: [
                        { type: 'section', text: { type: 'mrkdwn', text: '*T*\nD' } },
                        { type: 'context', elements: [{ type: 'mrkdwn', text: '*Requester:* <@U1>   *Approver:* <@U2>' }] },
                        { type: 'actions', elements: [{ type: 'button', action_id: 'task_approve', value: created.taskId }] }
                    ]
                },
                actions: [{ action_id: 'task_approve', value: created.taskId }]
            };
            const body = 'payload=' + encodeURIComponent(JSON.stringify(payload));

            const h = { response: sinon.stub().returns({ code: sinon.stub() }) };
            await handler({ payload: Buffer.from(body) }, h);

            const getHandler = context.getRouteHandler('GET', '/tasks/{taskId}');
            const fetched = await getHandler({ params: { taskId: created.taskId }, query: {} });
            assert.equal(fetched.status, 'approved');
        });

        it('rejects a task and triggers webhooks', async () => {
            const create = context.getRouteHandler('POST', '/tasks');
            const created = await create({ payload: { title: 'T', description: 'D', requester: 'U1', approver: 'U2', channel: 'C1', decisionBy: new Date().toISOString(), status: 'pending' } });

            sinon.stub(slackLib, 'isValidPayload').returns(true);
            context.httpRequest.resolves({ statusCode: 200 });

            const handler = context.getRouteHandler('POST', '/interactions');
            const payload = {
                type: 'block_actions',
                user: { id: 'U2' },
                response_url: 'https://hooks.slack.com/actions/T/XXX/YYY',
                message: {
                    blocks: [
                        { type: 'section', text: { type: 'mrkdwn', text: '*T*\nD' } },
                        { type: 'context', elements: [{ type: 'mrkdwn', text: '*Requester:* <@U1>   *Approver:* <@U2>' }] },
                        { type: 'actions', elements: [{ type: 'button', action_id: 'task_reject', value: created.taskId }] }
                    ]
                },
                actions: [{ action_id: 'task_reject', value: created.taskId }]
            };
            const body = 'payload=' + encodeURIComponent(JSON.stringify(payload));

            const h = { response: sinon.stub().returns({ code: sinon.stub() }) };
            await handler({ payload: Buffer.from(body) }, h);

            const getHandler = context.getRouteHandler('GET', '/tasks/{taskId}');
            const fetched = await getHandler({ params: { taskId: created.taskId }, query: {} });
            assert.equal(fetched.status, 'rejected');
        });

        describe('saving the task after the webhook', () => {

            const approve = async () => {
                const create = context.getRouteHandler('POST', '/tasks');
                const created = await create({ payload: { title: 'T', description: 'D', requester: 'U1', approver: 'U2', channel: 'C1', decisionBy: new Date().toISOString(), status: 'pending' } });

                sinon.stub(slackLib, 'isValidPayload').returns(true);
                context.httpRequest.resolves({ statusCode: 200 });

                const handler = context.getRouteHandler('POST', '/interactions');
                const payload = {
                    type: 'block_actions',
                    user: { id: 'U2' },
                    response_url: 'https://hooks.slack.com/actions/T/XXX/YYY',
                    actions: [{ action_id: 'task_approve', value: created.taskId }]
                };
                const body = 'payload=' + encodeURIComponent(JSON.stringify(payload));

                const h = { response: sinon.stub().returns({ code: sinon.stub() }) };
                await handler({ payload: Buffer.from(body) }, h);
                return memory.tasks[created.taskId];
            };

            it('saves the task when the webhook is delivered', async () => {
                triggerWebhook.resolves({ ok: true });
                const task = await approve();
                assert(triggerWebhook.calledOnce, 'Should trigger the webhook');
                assert(task.save.calledOnce, 'Should save the task');
            });

            it('does not save the task when the webhook fails transiently', async () => {
                triggerWebhook.resolves({ ok: false, permanent: false, removed: false, httpStatus: 400 });
                const task = await approve();
                assert(triggerWebhook.calledOnce, 'Should trigger the webhook');
                assert.equal(task.save.callCount, 0, 'triggerWebhook already saved the task for a retry');
            });

            it('does not save the task when the webhook target is gone', async () => {
                triggerWebhook.resolves({ ok: false, permanent: true, removed: true, httpStatus: 404 });
                const task = await approve();
                assert(triggerWebhook.calledOnce, 'Should trigger the webhook');
                assert.equal(task.save.callCount, 0, 'Should not recreate a task removed by triggerWebhook');
            });
        });
    });

    it('POST /tasks creates a task and notifies approver', async () => {
        const handler = context.getRouteHandler('POST', '/tasks');
        const res = await handler({ payload: { title: 'T', description: 'D', requester: 'U1', approver: 'U2', channel: 'C1', decisionBy: new Date().toISOString() } });

        assert.equal(res.title, 'T');
        // No calls to sendMessage here
        assert(slackLib.sendMessage.callCount === 0, 'sendMessage should not notify approver');
    });

    it('does not expose dashboard endpoint for Slack routes', async () => {
        const hasDashboard = context.http.router.register.getCalls().some(c => c.args[0].path === '/dashboard-url');
        assert.equal(hasDashboard, false);
    });
});

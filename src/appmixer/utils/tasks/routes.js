'use strict';
const check = require('check-types');

/**
 * @param {Object} context
 * @param {Object} context.http.router
 * @param {Object} context.http.HttpError
 * @param {Object} context.http.auth
 * @param {Object} options
 * @param {string} options.secret
 */
module.exports = (context, options) => {

    check.assert.string(options.secret, 'Secret not defined for People Tasks.');

    const utils = require('./utils')(context);
    const Task = require('./TaskModel')(context);
    const Webhook = require('./WebhookModel')(context);
    const config = require('./config')(context);

    context.http.router.register({
        method: 'GET',
        path: '/',
        options: {
            handler: () => {
                return {
                    version: '1.0'
                };
            },
            auth: false
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/webhooks',
        options: {
            handler: req => {
                const { url, taskId } = req.payload;
                return new Webhook().populate({
                    url,
                    taskId,
                    created: new Date(),
                    status: Webhook.STATUS_PENDING
                }).save();
            },
            validate: {
                payload: context.http.Joi.object({
                    url: context.http.Joi.string().uri().required(),
                    taskId: context.http.Joi.string().required()
                })
            }
        }
    });

    context.http.router.register({
        method: 'DELETE',
        path: '/webhooks/{webhookId}',
        options: {
            handler: async (req, h) => {
                await Webhook.deleteById(req.params.webhookId);
                return h.response({});
            }
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/tasks',
        options: {
            handler: async req => {
                const user = await context.http.auth.getUser(req);
                const { selector, limit, offset, sort, projection } =
                    await utils.prepareTasksQuery(user, req.query);
                const tasks = await Task.find(selector, { limit, skip: offset, sort, projection });

                return tasks.map(task =>
                    task.addIsApprover(user, req.query.secret).toJson()
                );
            },
            auth: {
                strategies: ['jwt-strategy', 'public']
            }
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/tasks-count',
        options: {
            handler: async (req, h) => {
                const user = await context.http.auth.getUser(req);
                const { selector } = await utils.prepareTasksQuery(user, req.query);
                return h.response({ count: await Task.count(selector) });
            },
            auth: {
                strategies: ['jwt-strategy', 'public']
            }
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/tasks/{taskId}',
        options: {
            handler: async req => {
                req.pre.user = await context.http.auth.getUser(req);
                req.pre.task = await utils.getTask(req);
                await utils.verifyTaskPerm(req);
                return task.addIsApprover(req.pre.user, req.query.secret).toJson();
            },
            auth: {
                strategies: ['jwt-strategy', 'public']
            }
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/tasks',
        options: {
            handler: async req => {

                const payload = (Object.assign(req.payload, { status: Task.STATUS_PENDING }));

                check.assert.nonEmptyString(payload.approver, 'Missing approver email.');
                check.assert.nonEmptyString(payload.requester, 'Missing requester email.');

                return new Task().populate({
                    ...payload,
                    approverSecret: await utils.generateSecret(payload.approver, options.secret),
                    requesterSecret: await utils.generateSecret(payload.requester, options.secret),
                    decisionBy: new Date(payload.decisionBy),       // convert to Date type
                    created: new Date()
                }).save();
            },
            validate: {
                payload: context.http.Joi.object({
                    title: context.http.Joi.string().required(),
                    description: context.http.Joi.string(),
                    requester: context.http.Joi.string().email().required(),
                    approver: context.http.Joi.string().email().required(),
                    decisionBy: context.http.Joi.date().iso()
                })
            }
        }
    });

    context.http.router.register({
        method: 'PUT',
        path: '/tasks/{taskId}',
        options: {
            handler: async req => {
                req.pre.user = await context.http.auth.getUser(req);
                req.pre.task = await utils.getTask(req);
                await utils.verifyTaskPerm(req);
                if (req.payload.decisionBy) {
                    req.payload.decisionBy = new Date(req.payload.decisionBy);  // convert to Date type
                }
                await req.pre.task.populate(req.payload).save();
                return req.pre.task.toJson();
            }
        }
    });

    context.http.router.register({
        method: 'PUT',
        path: '/tasks/{taskId}/approve',
        options: {
            handler: async (req, h) => {
                req.pre.user = await context.http.auth.getUser(req);
                req.pre.task = await utils.getTask(req);
                await utils.verifyTaskPerm(req);
                if ([Task.STATUS_REJECTED, Task.STATUS_APPROVED].indexOf(req.pre.task.getStatus()) !== -1) {
                    throw new context
                        .http
                        .HttpError
                        .badRequest(`Cannot approve task, already ${req.pre.task.getStatus()}`);
                }
                req.pre.task.setStatus(Task.STATUS_APPROVED);
                req.pre.task.setDecisionMade(new Date());
                await utils.triggerWebhooks(req.pre.task);
                await req.pre.task.save();
                return req.pre.task.toJson();
            },
            auth: {
                strategies: ['jwt-strategy', 'public']
            }
        }
    });

    context.http.router.register({
        method: 'PUT',
        path: '/tasks/{taskId}/reject',
        options: {
            handler: async (req, h) => {
                req.pre.user = await context.http.auth.getUser(req);
                req.pre.task = await utils.getTask(req);
                await utils.verifyTaskPerm(req);
                if ([Task.STATUS_REJECTED, Task.STATUS_APPROVED].indexOf(req.pre.task.getStatus()) !== -1) {
                    throw new context
                        .http
                        .HttpError
                        .badRequest(`Cannot reject task, already ${req.pre.task.getStatus()}`);
                }
                req.pre.task.setStatus(Task.STATUS_REJECTED);
                req.pre.task.setDecisionMade(new Date());
                await utils.triggerWebhooks(req.pre.task);
                await req.pre.task.save();
                return req.pre.task.toJson();
            },
            auth: {
                strategies: ['jwt-strategy', 'public']
            }
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/dashboard-url',
        options: {
            handler: async () => {
                if (!config.peopleTasksDashboard) {
                    throw new context.http.HttpError.badRequest('People Task dashboard URL is not configured.');
                }
                const dashboardUrl = config.peopleTasksDashboard;
                return { dashboardUrl };
            }
        }
    });
};

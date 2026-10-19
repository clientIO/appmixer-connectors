'use strict';

module.exports = (context) => {

    const querystring = require('querystring');
    const utils = require('./taskUtils.js')(context);
    const Task = require('./SlackTaskModel.js')(context);
    const slackLib = require('./lib.js');

    context.http.router.register({
        method: 'GET',
        path: '/tasks/version',
        options: {
            handler: () => ({ version: '1.0' }),
            auth: false
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/tasks/{taskId}',
        options: {
            handler: async req => {
                const slackUserId = req.query.slackUserId;
                const task = await Task.findById(req.params.taskId);
                // Optionally, add permission checks for Slack users here
                return task.addIsApprover(slackUserId, req.query.secret).toJson();
            },
            auth: false
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/tasks',
        options: {
            handler: async req => {
                const {
                    status,
                    title,
                    requester,
                    approver,
                    limit = 100
                } = req.query;

                // Build query object
                const query = {};

                if (status) {
                    query.status = status;
                }

                if (title) {
                    // Case-insensitive partial match for title
                    query.title = { $regex: title, $options: 'i' };
                }

                if (requester) {
                    query.requester = requester;
                }

                if (approver) {
                    query.approver = approver;
                }

                const tasks = await Task.find(query, { limit: parseInt(limit, 10) });
                return tasks.map(task => task.toJson());
            },
            auth: false,
            validate: {
                query: context.http.Joi.object({
                    status: context.http.Joi.string().valid('pending', 'approved', 'rejected', 'due', 'error'),
                    title: context.http.Joi.string(),
                    requester: context.http.Joi.string(),
                    approver: context.http.Joi.string(),
                    limit: context.http.Joi.number().integer().min(1).max(1000).default(100)
                })
            }
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/tasks',
        options: {
            handler: async req => {

                context.log('debug', 'slack-plugin-route-tasks-create', req.payload);

                const task = await new Task().populate({
                    ...req.payload,
                    status: Task.STATUS_PENDING,
                    decisionBy: new Date(req.payload.decisionBy),
                    channel: req.payload.channel,
                    created: new Date()
                }).save();

                return task;
            },
            validate: {
                payload: context.http.Joi.object({
                    title: context.http.Joi.string().required(),
                    description: context.http.Joi.string(),
                    requester: context.http.Joi.string().required(), // Slack user ID
                    approver: context.http.Joi.string().required(), // Slack user ID
                    channel: context.http.Joi.string().required(), // Slack channel ID
                    webhookUrl: context.http.Joi.string().uri().required(),
                    decisionBy: context.http.Joi.date().iso(),
                    username: context.http.Joi.string(),
                    iconUrl: context.http.Joi.string()
                })
            }
        }
    });

    // Receive Slack interactions (e.g., button clicks)
    // From Slack: All apps must, as a minimum, acknowledge the receipt of a valid interaction payload.
    // See https://api.slack.com/interactivity/handling#acknowledgment_response
    context.http.router.register({
        method: 'POST',
        path: '/interactions',
        options: {
            payload: {
                parse: false, // Changing this later won't propagate to the server
                output: 'data',
                allow: 'application/x-www-form-urlencoded'
            },
            auth: false,
            handler: async (req, h) => {

                // `req.payload` is a Buffer, so we need to parse it
                const rawBody = req.payload.toString('utf8'); // raw buffer as string

                // Then parse the payload as query string
                const parsed = querystring.parse(rawBody);
                const payload = JSON.parse(parsed.payload);

                // Validate Slack signature if this is engine pod and not using AuthHub
                const isFromAuthHub = !!req.headers?.['x-appmixer-forwarded-from-authhub'];
                if (!isFromAuthHub && !slackLib.isValidPayload(context, req)) {
                    return h.response(undefined).code(401);
                }

                const { actions, response_url: responseUrl } = payload;
                if (!actions || !Array.isArray(actions) || actions.length === 0) {
                    return h.response({ text: 'No actions found' }).code(400);
                }
                // value format: taskId|host, e.g. "taskId|https://api.acme.appmixer.cloud"
                const [taskId, host] = actions[0].value?.split('|') || [];
                if (!taskId) {
                    context.log('error', 'slack-plugin-route-interaction-missing-task-id', payload);
                    return h.response({ text: 'Missing task ID' }).code(400);
                }
                const action = actions[0].action_id;

                // -- AuthHub processing start --
                // If this is AuthHub, forward the request to the tenant
                const isAuthHubPod = !!process.env.AUTH_HUB_URL && !process.env.AUTH_HUB_TOKEN;
                if (isAuthHubPod) {
                    if (!host) {
                        context.log('error', 'slack-plugin-route-interaction-missing-host', { action, taskId });
                        return h.response({ text: 'Missing tenant host information' }).code(400);
                    } else if (process.env.AUTH_HUB_URL === host) {
                        context.log('error', 'slack-plugin-route-interaction-invalid-host', { action, taskId, host });
                        return h.response({ text: 'Invalid tenant host information' }).code(400);
                    }

                    // Forward the entire payload as-is to the tenant plugin
                    // - we don't use the ususal context.triggerListeners because they trigger the component directly
                    // - instead we need to go through the tenant's /interactions endpoint
                    const tenantInteractionsURL = `${host}/plugins/appmixer/slack/interactions`;
                    try {
                        const { data, status } = await context.httpRequest({
                            url: tenantInteractionsURL,
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'x-appmixer-forwarded-from-authhub': true
                                // Not sending Slack signature headers, we already validated them
                            },
                            data: req.payload
                        });
                        return h.response(data).code(status);
                    } catch (err) {
                        // Possible reasons for failure:
                        // - flow is stopped
                        // - network error
                        // - tenant pod not reachable
                        // - tenant pod returns an error (4xx, 5xx)
                        context.log('error', 'slack-plugin-route-interaction-forward-error', {
                            action,
                            taskId,
                            host,
                            error: context.utils.Error.stringify(err)
                        });
                        return h.response({ text: 'Error forwarding request to tenant' }).code(500);
                    }
                }
                // -- AuthHub processing end --

                // Normal processing below - tenant pod

                // Handle Task Approval actions
                if (action.startsWith('task_')) {
                    await handleTaskAction(context, h, action, taskId, payload, responseUrl);
                    return h.response({ text: 'Action received' }).code(200);
                }

                return h.response({ text: 'Action received' }).code(200);
            }
        }
    });

    /** This always runs in the tenant, never in AuthHub */
    async function handleTaskAction(context, h, action, taskId, payload, responseUrl) {

        const task = await Task.findById(taskId);
        if (!task) {
            context.log('error', 'slack-plugin-route-interaction-task-not-found', { taskId });
            return h.response({ text: 'Task not found' }).code(404);
        }

        // Validate that the user clicking the button is the designated approver
        const actorUserId = payload?.user?.id;
        if (!actorUserId) {
            context.log('error', 'slack-plugin-route-interaction-no-user-id', { taskId });
            return h.response({ text: 'Unable to identify user' }).code(400);
        }

        if (actorUserId !== task.approver) {
            context.log('warn', 'slack-plugin-route-interaction-unauthorized-user', {
                taskId,
                actorUserId,
                expectedApprover: task.approver
            });

            // Send response to the user who clicked
            await context.httpRequest({
                method: 'POST',
                url: responseUrl,
                headers: { 'Content-Type': 'application/json' },
                data: {
                    text: `❌ Only <@${task.approver}> can approve or reject this task.`,
                    response_type: 'ephemeral'
                }
            });
            return;
        }

        context.log('info', 'slack-plugin-route-interaction-task-details', task);
        context.log('info', 'slack-plugin-route-interaction-payload-details', payload);

        let webhookResult;
        if (action === 'task_approve') {
            task.setStatus(Task.STATUS_APPROVED);
            task.setDecisionMade(new Date());
            task.setActor(actorUserId);
            webhookResult = await utils.triggerWebhook(task);
            context.log('info', 'slack-plugin-route-interaction-task-approved', { taskId });
        } else if (action === 'task_reject') {
            task.setStatus(Task.STATUS_REJECTED);
            task.setDecisionMade(new Date());
            task.setActor(actorUserId);
            webhookResult = await utils.triggerWebhook(task);
            context.log('info', 'slack-plugin-route-interaction-task-rejected', { taskId });
        } else {
            context.log('error', 'slack-plugin-route-interaction-unknown-action', { action });
            return h.response({ text: 'Unknown action' }).code(400);
        }

        // On failure, triggerWebhook already saved the task for a retry or removed it for good.
        if (webhookResult?.ok) {
            await task.save();
        }

        // Send a response to the user
        // Build a block-preserving response that removes buttons and appends a status line
        const approved = action === 'task_approve';
        const actor = payload?.user?.id ? `<@${payload.user.id}>` : 'Someone';
        const emoji = approved ? ':white_check_mark:' : ':x:';
        const statusLine = `${emoji} ${actor} ${approved ? 'approved' : 'rejected'} this task.`;

        let responseMessage;
        try {
            const originalBlocks = Array.isArray(payload?.message?.blocks) ? payload.message.blocks : [];
            if (originalBlocks.length) {
                const filtered = originalBlocks.filter(b => b && b.type !== 'actions');
                filtered.push({
                    type: 'context',
                    elements: [
                        { type: 'mrkdwn', text: statusLine }
                    ]
                });
                responseMessage = { replace_original: true, blocks: filtered };
            }
        } catch (e) {
            context.log('error', 'slack-plugin-route-interaction-blocks-transform-error', { error: e?.message });
        }

        if (!responseMessage) {
            responseMessage = {
                text: `Task ${task.title || task.taskId} has been ${approved ? 'approved' : 'rejected'} by ${actor}.`,
                replace_original: true
            };
        }

        await context.httpRequest({
            method: 'POST',
            url: responseUrl,
            headers: { 'Content-Type': 'application/json' },
            data: responseMessage
        });
    }
};

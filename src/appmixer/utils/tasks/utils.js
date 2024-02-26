'use strict';
const check = require('check-types');
const _ = require('lodash');
const crypto = require('crypto');
const Promise = require('bluebird');
const request = require('request-promise');

function postContent(url, body) {

    return request({
        method: 'POST',
        url,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body,
        json: true
    });
}

module.exports = context => {

    const Task = require('./TaskModel')(context);
    const Webhook = require('./WebhookModel')(context);
    const query = require('./query')(context);

    return {

        /**
         * Generates a hash secret based on approver/requester email
         * @param {string} email
         * @param {string} secret
         * @return {string}
         * @throws Error
         */
        generateSecret: function(email, secret) {

            check.assert.nonEmptyString(email, 'Missing email param.');
            return crypto.createHmac('sha256', secret).update(email).digest('hex');
        },

        /**
         * Verifies task permission.
         * @param req
         * @return {Promise<boolean>}
         */
        verifyTaskPerm: async function(req) {

            const { task } = req.pre;
            const payload = req.payload || {};
            const query = req.query || {};

            const secret = payload.secret || query.secret;

            if (!task) {
                throw context.http.HttpError.badRequest('Missing task.');
            }

            check.assert.object(req.pre.user, 'Invalid user object.');

            if (req.pre.user.getId().equals(context.constants.PUBLIC_USER_ID)) {
                // no user logged in, then the secret has to equal approver secret
                check.assert.nonEmptyString(secret, 'Missing secret.');
                if (secret === task.approverSecret) {
                    return true;
                }
                throw context.http.HttpError.forbidden();
            }

            if (req.pre.user.getEmail() === task.approver) {
                // logged in user is the approver
                return true;
            }

            check.assert.nonEmptyString(secret, 'Missing secret.');
            if (secret === task.approverSecret) {
                // logged in user is not the approver, but he knows the secret, allow it
                return true;
            }

            throw context.http.HttpError.forbidden();
        },

        /**
         * Gets task using taskId request parameter.
         * @param req
         * @return {Promise<*>}
         */
        getTask: async function(req) {

            const { taskId } = req.params;

            if (!taskId) {
                throw context.http.HttpError.badRequest('Missing task Id.');
            }

            const task = await Task.findById(taskId);

            if (!task) {
                throw context.http.HttpError.notFound('Task not found.');
            }

            return task;
        },

        /**
         * Do not return secrets in GET requests.
         * @param {Task} task
         * @throws Error
         */
        omitSecrets: function(task) {

            check.assert.instance(task, Task, 'Invalid Task instance.');
            return _.omit(task, 'approverSecret', 'requesterSecret');
        },

        /**
         * @param {Webhook} webhook
         * @param {Task} [task]
         * @return {Promise<boolean>}
         * @throws Error
         */
        triggerWebhook: async function(webhook, task = null) {

            check.assert.instance(webhook, Webhook, 'Invalid webhook instance.');

            task = task || await Task.findById(webhook.getTaskId());

            let newStatus = null;
            try {
                await postContent(webhook.getUrl(), task.toJson());
                newStatus = { 'status': Webhook.STATUS_SENT };
                return true;
            } catch (err) {
                newStatus = {
                    'status': Webhook.STATUS_FAIL,
                    'error': context.utils.Error.stringify(err)
                };
                return false;
            } finally {
                await (await Webhook.findById(webhook.getId())).populate(newStatus).save();
            }
        },

        /**
         * Trigger webhooks.
         * @param {Task} task
         * @return {Promise<void>}
         * @throws Error
         */
        triggerWebhooks: async function(task) {

            check.assert.instance(task, Task, 'Invalid task instance.');

            const webhooks = await Webhook.find({ 'taskId': task.getId(), 'status': 'pending' });
            return Promise.map(webhooks, webhook => {
                return this.triggerWebhook(webhook, task);
            });
        },

        /**
         * Set some parameters according to the request object and authentication status
         * @param {User} user
         * @param {Object} options
         * @returns {Promise<{selector, projection, sort, limit, offset}>}
         */
        prepareTasksQuery: async function(user, options = {}) {

            let userSelector = {};

            if (options.secret) {
                userSelector.secret = options.secret;
            } else if (!user.getId().equals(context.constants.PUBLIC_USER_ID)) {
                userSelector.email = user.getEmail();
            } else {
                check.assert.string(options.secret, 'Missing secret query parameter.');
            }

            return query.buildTasksQuery(userSelector, options);
        }
    };
};


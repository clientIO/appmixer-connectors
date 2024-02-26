'use strict';
const commons = require('../../highrise-commons');
const Promise = require('bluebird');

/**
 * @param {Object} taskProp
 * @return {Object}
 */
function buildTask(taskProp) {

    return {
        'body': taskProp['body'],
        'frame': taskProp['frame'],
        'category_id': taskProp['categoryId']
    };
}

/**
 * Component for adding a task.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { companyId } = context.properties;
        let newTask = context.messages.task.content;
        const options = { userAgent: context.auth.userAgent };
        let client = commons.getHighriseAPI(companyId, context.auth.accessToken, options);
        let createTask = Promise.promisify(client.task.create, { context: client.task });

        return createTask(
            buildTask(newTask)
        ).then(newTask => {
            delete newTask.client;
            return context.sendJson(newTask, 'newTask');
        });
    }
};


'use strict';
const commons = require('../../asana-commons');

/**
 * Component which deletes a task if triggered.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const client = commons.getAsanaAPI(context.auth.accessToken);
        let { task } = context.messages.in.content;

        await client.tasks.delete(task);

        return context.sendJson({ gid: task }, 'deleted');
    }
};

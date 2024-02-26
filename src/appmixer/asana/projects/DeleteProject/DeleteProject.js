'use strict';
const commons = require('../../asana-commons');

/**
 * Component which deletes a project if triggered.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const client = commons.getAsanaAPI(context.auth.accessToken);
        const { project } = context.messages.in.content;

        await client.projects.delete(project);

        return context.sendJson({ gid: project }, 'deleted');
    }
};

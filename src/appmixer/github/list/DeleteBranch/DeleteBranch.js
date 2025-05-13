'use strict';
const lib = require('../../lib');

/**
 * Component for deleting a branch
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let { repository, branch } = context.messages.in.content;

        await lib.apiRequest(context, `repos/${repository}/git/refs/heads/${branch}`, {
            method: 'DELETE'
        });

        return context.sendJson({ branch }, 'out');
    }
};

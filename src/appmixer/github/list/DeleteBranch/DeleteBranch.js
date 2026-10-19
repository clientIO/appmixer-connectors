'use strict';
const lib = require('../../lib');

/**
 * Component for deleting a branch
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let { repository, branch } = context.messages.in.content;
        if (!repository) {
            throw new context.CancelError('Repository is required!');
        }
        if (!branch) {
            throw new context.CancelError('Branch is required!');
        }

        await lib.apiRequest(context, `repos/${repository}/git/refs/heads/${branch}`, {
            method: 'DELETE'
        });

        return context.sendJson({ branch }, 'out');
    }
};

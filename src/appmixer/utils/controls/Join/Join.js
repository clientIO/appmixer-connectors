'use strict';

/**
 * @extends {Component}
 */
module.exports = {

    /**
     * @param {Context} context
     */
    receive(context) {

        return context.sendJson(context.messages.in.content, 'out');
    }
};

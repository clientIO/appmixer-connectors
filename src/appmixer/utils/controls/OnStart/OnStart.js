'use strict';

/**
 * OnStart component reacts on the 'start' message only. It triggers when the flow starts.
 * @extends {Component}
 */
module.exports = {

    /**
     * @param {Context} context
     */
    start(context) {

        return context.sendJson({ started: (new Date()).toISOString() }, 'out');
    }
};

'use strict';

/**
 * OnStart component reacts on the 'start' message only. It triggers when the flow starts.
 * @extends {Component}
 */
module.exports = {

    /**
     * @param {Context} context
     */
    receive(context) {

        return context.sendJson({ outvalue: context.messages.in.content.value }, 'out');
    }
};

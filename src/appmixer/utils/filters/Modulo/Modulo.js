'use strict';

/**
 * @extends {Component}
 */
module.exports = {

    /**
     * @param {Context} context
     */
    receive(context) {

        let { sourceData = '', value = '' } = context.messages.in.content;
        const modulo = parseFloat(sourceData) % parseFloat(value);
        return context.sendJson(modulo, 'modulo');
    }
};

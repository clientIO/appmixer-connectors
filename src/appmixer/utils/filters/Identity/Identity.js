'use strict';

/**
 * @extends {Component}
 */
module.exports = {

    /**
     * @param {Context} context
     */
    receive(context) {

        const incoming = context.messages.in;
        return context.send(incoming.content, 'out', incoming.contentType, incoming.contentEncoding);
    }
};

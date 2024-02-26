'use strict';

/**
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { sourceData = '', value = '' } = context.messages.in.content;
        if (sourceData == value) {
            return context.sendJson(context.messages.in.originalContent, 'equals');
        } else {
            return context.sendJson(context.messages.in.originalContent, 'notEquals');
        }
    }
};

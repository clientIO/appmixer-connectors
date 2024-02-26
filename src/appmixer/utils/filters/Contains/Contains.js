'use strict';

/**
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { sourceData, value } = context.messages.in.content;

        sourceData = typeof sourceData != 'string' ? JSON.stringify(sourceData) : sourceData;
        value = typeof value != 'string' ? JSON.stringify(value) : value;

        if (sourceData.toLowerCase().indexOf(value.toLowerCase()) > -1) {
            return context.sendJson(context.messages.in.originalContent, 'contains');
        } else {
            return context.sendJson(context.messages.in.originalContent, 'notContains');
        }
    }
};

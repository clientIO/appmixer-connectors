'use strict';

/**
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const { sourceData, value } = context.messages.in.content;

        if (contains(sourceData, value)) {
            return context.sendJson(context.messages.in.originalContent, 'contains');
        } else {
            return context.sendJson(context.messages.in.originalContent, 'notContains');
        }
    }
};

function contains(sourceData, value) {

    // A missing input (e.g. a null field from the upstream component) does not contain anything.
    if (sourceData === undefined || sourceData === null) {
        return false;
    }
    if (typeof sourceData != 'string') {
        sourceData = JSON.stringify(sourceData);
    }
    if (typeof value != 'string') {
        value = JSON.stringify(value);
    }
    // JSON.stringify() returns undefined for undefined, functions and symbols.
    if (typeof sourceData != 'string' || typeof value != 'string') {
        return false;
    }
    return sourceData.toLowerCase().indexOf(value.toLowerCase()) > -1;
}

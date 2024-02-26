'use strict';
const _  = require('lodash');

/**
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const data = context.messages.in.content.sourceData;
        const isNumberOrBoolean = _.isNumber(data) || _.isBoolean(data);

        // If data is a number or boolean, it is not empty.
        if (_.isEmpty(data) && !isNumberOrBoolean) {
            return context.sendJson(context.messages.in.originalContent, 'empty');
        } else {
            return context.sendJson(context.messages.in.originalContent, 'notEmpty');
        }
    }
};

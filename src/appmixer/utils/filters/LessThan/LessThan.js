'use strict';
const utils = require('../filter-commons');

/**
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { sourceData = '', lessThan = '', exclusive } = context.messages.in.content;
        let pass = false;

        if (utils.isNumber(sourceData) && utils.isNumber(lessThan)) {
            if (this.isNumberLessThan(utils.toNumber(sourceData), utils.toNumber(lessThan), exclusive)) {
                pass = true;
            }
        } else if (utils.isDate(sourceData) && utils.isDate(lessThan)) {
            if (this.isDateLessThan(sourceData, lessThan, exclusive)) {
                pass = true;
            }
        }

        if (pass) {
            return context.sendJson(context.messages.in.originalContent, 'less');
        } else {
            return context.sendJson(context.messages.in.originalContent, 'notLess');
        }
    },

    isNumberLessThan(a, b, exclusive) {

        return a < b || (!exclusive && a == b);
    },

    isDateLessThan(a, b, exclusive) {

        return utils.isDateBefore(a, b) || (!exclusive && utils.isDateSame(a, b));
    }
};

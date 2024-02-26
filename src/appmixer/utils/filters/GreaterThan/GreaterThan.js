'use strict';
const utils = require('../filter-commons');

/**
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { sourceData = '', greaterThan = '', exclusive } = context.messages.in.content;
        let pass = false;

        if (utils.isNumber(sourceData) && utils.isNumber(greaterThan)) {
            if (this.isNumberGreaterThan(utils.toNumber(sourceData), utils.toNumber(greaterThan), exclusive)) {
                pass = true;
            }
        } else if (utils.isDate(sourceData) && utils.isDate(greaterThan)) {
            if (this.isDateGreaterThan(sourceData, greaterThan, exclusive)) {
                pass = true;
            }
        }

        if (pass) {
            return context.sendJson(context.messages.in.originalContent, 'greater');
        } else {
            // if not pass, it doesn't necessary mean it's less than, because items could be
            // types which cannot be compared
            return context.sendJson(context.messages.in.originalContent, 'notGreater');
        }
    },

    isNumberGreaterThan(a, b, exclusive) {

        if (a > b || (!exclusive && a == b)) {
            return true;
        }
        return false;
    },

    isDateGreaterThan(a, b, exclusive) {

        if (utils.isDateAfter(a, b) || (!exclusive && utils.isDateSame(a, b))) {
            return true;
        }
        return false;
    }
};

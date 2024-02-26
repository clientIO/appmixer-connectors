'use strict';
const utils = require('../filter-commons');

/**
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { sourceData = '', rangeMin = '', rangeMax = '', exclusiveMin, exclusiveMax } = context.messages.in.content;
        let pass = false;

        if (utils.isNumber(sourceData) && utils.isNumber(rangeMin) && utils.isNumber(rangeMax)) {
            if (this.isNumberInRange(
                utils.toNumber(sourceData),
                utils.toNumber(rangeMin),
                utils.toNumber(rangeMax),
                exclusiveMin, exclusiveMax)) {
                pass = true;
            }
        } else if (utils.isDate(sourceData) && utils.isDate(rangeMin) && utils.isDate(rangeMax)) {
            if (this.isDateInRange(sourceData, rangeMin, rangeMax, exclusiveMin, exclusiveMax)) {
                pass = true;
            }
        }

        if (pass) {
            return context.sendJson(context.messages.in.originalContent, 'inRange');
        } else {
            return context.sendJson(context.messages.in.originalContent, 'notInRange');
        }
    },

    isNumberInRange(a, x1, x2, exclusiveX1, exclusiveX2) {

        if ((a > x1 || (!exclusiveX1 && a == x1)) &&
            (a < x2 || (!exclusiveX2 && a == x2))) {
            return true;
        }
        return false;
    },

    isDateInRange(a, x1, x2, exclusiveX1, exclusiveX2) {

        if ((utils.isDateAfter(a, x1) || (!exclusiveX1 && utils.isDateSame(a, x2))) &&
            (utils.isDateBefore(a, x2) || (!exclusiveX2 && utils.isDateSame(a, x2)))) {
            return true;
        }
        return false;
    }
};

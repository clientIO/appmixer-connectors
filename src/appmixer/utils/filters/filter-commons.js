'use strict';
const moment = require('moment');

module.exports = {

    /**
     * Return true if the string passed as the only argument can be converted into a number.
     * @param {string} text Any text.
     * @return {boolean}
     */
    isNumber: function(text) {

        return !isNaN(Number(text));
    },

    /**
     * Convert text to number.
     * @param {string} text Any text.
     * @return {number}
     */
    toNumber: function(text) {

        return Number(text);
    },

    /**
     * Return true if the string passed as the only argument can be converted into a date.
     * @param {string} text Any text.
     * @return {boolean}
     */
    isDate: function(text) {

        return moment(text).isValid();
    },

    /**
     * Return true if the first date is before the second date.
     * @param {string} a Date represented as string.
     * @param {string} b Date represented as string.
     * @return {boolean}
     */
    isDateBefore: function(a, b) {

        return moment(a).isBefore(moment(b));
    },

    /**
     * Return true if the first date is after the second date.
     * @param {string} a Date represented as string.
     * @param {string} b Date represented as string.
     * @return {boolean}
     */
    isDateAfter: function(a, b) {

        return moment(a).isAfter(moment(b));
    },

    /**
     * Return true if the first date is the same as the second date.
     * @param {string} a Date represented as string.
     * @param {string} b Date represented as string.
     * @return {boolean}
     */
    isDateSame: function(a, b) {

        return moment(a).isSame(moment(b));
    }
};

'use strict';

const _ = require('lodash');
const moment = require('moment');

module.exports = {

    receive(context) {

        let expValid = true;
        if (!context.messages.in.content.expression) {
            return context.sendJson({}, 'false');
        }

        /** All AND expressions */
        const expressions = context.messages.in.content.expression['AND'];
        context.log({ step: 'expressions', expressions });

        for (let i in expressions) {
            const expressionAnd = expressions[i];
            /** Number of OR expressions that are valid */
            let okCount = 0;

            for (let j in expressionAnd['OR']) {
                const exp = expressionAnd['OR'][j];
                switch (exp.operator) {
                    case '=':
                        // Note that this is not the same as utils.filters.Equal.Equal.js
                        if (isLooseEqual(exp.input, exp.value)) {
                            okCount++;
                        }
                        break;
                    case '!=':
                        if (!isLooseEqual(exp.input, exp.value)) {
                            okCount++;
                        }
                        break;
                    case '>':
                        if (isGreaterThan(exp.input, exp.value, true)) {
                            okCount++;
                        }
                        break;
                    case '>=':
                        if (isGreaterThan(exp.input, exp.value, false)) {
                            okCount++;
                        }
                        break;
                    case '<':
                        if (isLessThan(exp.input, exp.value, true)) {
                            okCount++;
                        }
                        break;
                    case '<=':
                        if (isLessThan(exp.input, exp.value, false)) {
                            okCount++;
                        }
                        break;
                    case '%':
                        // This one differs from utils.filters.Modulo.Modulo.js
                        if (exp.input % exp.divisor === 0) {
                            okCount++;
                        }
                        break;
                    case 'empty':
                        if (!isNotEmpty(exp.input)) {
                            okCount++;
                        }
                        break;
                    case 'notEmpty':
                        if (isNotEmpty(exp.input)) {
                            okCount++;
                        }
                        break;
                    case 'contains':
                        if (contains(exp.input, exp.value)) {
                            okCount++;
                        }
                        break;
                    case 'range':
                        if (isInRange(exp.input, exp.rangeMin, exp.rangeMax, exp.exclusiveMin, exp.exclusiveMax)) {
                            okCount++;
                        }
                        break;
                    case 'regex':
                        const regex = new RegExp(exp.regex);
                        if (regex.test(exp.input)) {
                            okCount++;
                        }
                        break;
                    default:
                        throw new context.CancelError(`Unsupported operator: ${exp.operator}`);
                }
            }

            if (okCount === 0) {
                // None of the OR expressions inside single AND expression is valid, so the whole AND expression is invalid.
                expValid = false;
            }

        }
        if (expValid) {
            return context.sendJson({}, 'true');
        }

        return context.sendJson({}, 'false');
    }
};

function isLooseEqual(a, b) {

    // we cannot use strict comparison, input value from a FE input is (at the moment)
    // always a string. If you want to compare a number, it won't work. From a
    // source component, we can get a number, but we would be comparing that always
    // against a string
    // another solution would be to change the expression and first let the user
    // to select a type (number vs string) and then show text or number input.

    // For boolean values, we convert the boolean to string: true -> 'true' and compare
    // that against the expected value which is always a string.

    if (typeof a === 'boolean') {
        a = a.toString();
    }

    return a == b;
}

// All the functions below are taken from utils/filters/* and utils/filter-commons.js
function isNotEmpty(data) {

    const isNumberOrBoolean = _.isNumber(data) || _.isBoolean(data);

    // If data is a number or boolean, it is not empty.
    return !_.isEmpty(data) || isNumberOrBoolean;
}

function isGreaterThan(sourceData, greaterThan, exclusive) {

    if (!isNaN(Number(sourceData)) && !isNaN(Number(greaterThan))) {
        if (isNumberGreaterThan(Number(sourceData), Number(greaterThan), exclusive)) {
            return true;
        }
    } else if (isDate(sourceData) && isDate(greaterThan)) {
        if (isDateGreaterThan(sourceData, greaterThan, exclusive)) {
            return true;
        }
    }
    return false;
}

function isLessThan(sourceData, lessThan, exclusive) {

    if (!isNaN(Number(sourceData)) && !isNaN(Number(lessThan))) {
        if (isNumberLessThan(Number(sourceData), Number(lessThan), exclusive)) {
            return true;
        }
    } else if (isDate(sourceData) && isDate(lessThan)) {
        if (isDateLessThan(sourceData, lessThan, exclusive)) {
            return true;
        }
    }
    return false;
}

function isNumberGreaterThan(a, b, exclusive) {

    return a > b || (!exclusive && a == b);
}

function isNumberLessThan(a, b, exclusive) {

    return a < b || (!exclusive && a == b);
}

function isDateGreaterThan(a, b, exclusive) {

    if (moment(a).isAfter(moment(b)) || (!exclusive && moment(a).isSame(moment(b)))) {
        return true;
    }
    return false;
}

function isDateLessThan(a, b, exclusive) {

    if (moment(a).isBefore(moment(b)) || (!exclusive && moment(a).isSame(moment(b)))) {
        return true;
    }
    return false;
}

function isDate(text) {

    return moment(text).isValid();
}

function contains(sourceData, value) {

    if (typeof sourceData != 'string') {
        sourceData = JSON.stringify(sourceData);
    }
    if (typeof value != 'string') {
        value = JSON.stringify(value);
    }
    return sourceData.toLowerCase().indexOf(value.toLowerCase()) > -1;
}

function isInRange(sourceData, rangeMin, rangeMax, exclusiveMin, exclusiveMax) {

    if (!isNaN(Number(sourceData)) && !isNaN(Number(rangeMin)) && !isNaN(Number(rangeMax))) {
        if (isNumberInRange(Number(sourceData), Number(rangeMin), Number(rangeMax), exclusiveMin, exclusiveMax)) {
            return true;
        }
    } else if (isDate(sourceData) && isDate(rangeMin) && isDate(rangeMax)) {
        if (isDateInRange(sourceData, rangeMin, rangeMax, exclusiveMin, exclusiveMax)) {
            return true;
        }
    }
    return false;
}

function isNumberInRange(a, x1, x2, exclusiveX1, exclusiveX2) {

    if ((a > x1 || (!exclusiveX1 && a == x1)) &&
        (a < x2 || (!exclusiveX2 && a == x2))) {
        return true;
    }
    return false;
}

function isDateInRange(a, x1, x2, exclusiveX1, exclusiveX2) {

    if ((moment(a).isAfter(x1) || (!exclusiveX1 && moment(a).isSame(x2))) &&
        (moment(a).isBefore(x2) || (!exclusiveX2 && moment(a).isSame(x2)))) {
        return true;
    }
    return false;
}

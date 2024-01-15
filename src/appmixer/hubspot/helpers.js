'use strict';

/**
 * Remove undefined keys from body object. Does not mutate the given object and returns a new object instead.
 * @param {Object} body
 * @returns {Object}
 */
const trimUndefined = (body) => {

    const result = {};
    Object.keys(body).forEach(key => {
        if (typeof body[key] !== 'undefined') {
            result[key] = body[key];
        }
    });
    return result;
};

module.exports = {
    trimUndefined
};

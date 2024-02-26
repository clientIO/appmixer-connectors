'use strict';

/**
 * Remove undefined keys from body object
 * @param {Object} body
 * @returns {Object}
 */
const trimUndefined = (body) => {

    const result = {};
    Object.keys(body).forEach(key => {
        if (body[key]) {
            result[key] = body[key];
        }
    });
    return result;
};

module.exports = {
    trimUndefined
};

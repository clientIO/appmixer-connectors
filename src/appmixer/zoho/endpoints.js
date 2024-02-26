'use strict';
const check = require('check-types');

const domains = {
    'in': 'in',
    'us': 'com',
    'au': 'com.au',
    'eu': 'eu',
    'cn': 'com.cn'
};

/**
 * Get Top Level Domain.
 * @param {String} region
 * @returns
 */
const getTLD = region => {

    check.assert.string(region, `Missing region: ${region}.`);
    region = (region || '').toLowerCase();
    return domains[region] || domains['us'];
};

/**
 * Zoho Data Center specific account endpoint.
 * @param {String} region
 * @returns {String}
 */
const accountsEndpoint = region => {

    check.assert.string(region, `Missing region: ${region}.`);
    region = (region || '').toLowerCase();
    return 'https://accounts.zoho.'.concat(getTLD(region));
};

/**
 * Zoho Data Center specific API endpoint.
 * @param {String} region
 * @returns {String}
 */
const apiEndpoint = region => {

    check.assert.string(region, `Missing region: ${region}.`);
    return 'https://www.zohoapis.'.concat(getTLD(region));
};

module.exports = {
    accountsEndpoint,
    apiEndpoint
};

'use strict';
const lib = require('../lib');

module.exports = {
    async receive(context) {
        return context.sendJson(lib.getCredentials(context.auth), 'out');
    }
};

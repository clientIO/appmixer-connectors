'use strict';
const commons = require('../drive-commons');

module.exports = {
    async receive(context) {
        return context.sendJson(commons.getCredentials(context.auth), 'out');
    }
};

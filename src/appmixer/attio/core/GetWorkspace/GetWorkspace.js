'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        // https://docs.attio.com/rest-api/endpoint-reference/meta/identify
        const data = await lib.apiRequest(context, { path: '/v2/self' });
        return context.sendJson(lib.mapWorkspace(data), 'out');
    }
};

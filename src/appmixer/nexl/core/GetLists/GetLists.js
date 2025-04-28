'use strict';

const lib = require('../../lib');

module.exports = {

    async start(context) {
        const query = 'query {lists(filter: { listStatus: ACTIVE },page: 1,perPage: 500) {entries {id name contacts Count creator {id email}}}}';
        context.log({ query });
        const data = lib.apiRequest(context, query);

        return context.sendJson(data.data, 'out');
    }
};

'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        try {
            const lists = await lib.paginatedApiRequest(context, '/marketing/lists', 'result');

            return context.sendJson(lists, 'out');
        } catch (err) {
            if (context.properties.variableFetch) {
                return context.sendJson([], 'out');
            }
            context.log({ stage: 'Error', message: err.message, code: err.code });
            throw err;
        }
    }
};

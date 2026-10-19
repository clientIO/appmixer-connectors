'use strict';

const lib = require('../../lib');
const gqlCustomers = require('../../gql-customers');

/**
 * Count customers, optionally in a created / updated time range.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const query = gqlCustomers.buildCountQuery(context.messages.in.content);
        const count = await gqlCustomers(lib.runner(context)).count(query);
        return context.sendJson({ count }, 'out');
    }
};

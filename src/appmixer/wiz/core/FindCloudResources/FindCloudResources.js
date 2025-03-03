'use strict';
const lib = require('../../lib');
const resources = require('./resources');

module.exports = {

    // docs: https://win.wiz.io/reference/pull-cloud-resources
    async receive(context) {

        const { filter, limit = 10 } = context.messages.in.content;

        let filterBy;
        if (filter) {
            try {
                filterBy = JSON.parse(filter);
            } catch (e) {
                throw new context.CancelError('Invalid Input: Filter', e);
            }
        }

        const records = await resources.exposed.getResources(context, { filterBy, limit });

        return lib.sendArrayOutput({ context, records, outputType: 'object' });
    }
};

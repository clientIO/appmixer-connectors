'use strict';
const lib = require('../../lib');
const resources = require('./resources');

module.exports = {

    // docs: https://win.wiz.io/reference/pull-cloud-resources
    async receive(context) {

        const resourceType = 'exposed'; // exposed or cloud
        const resourceGetter = resources[resourceType];

        const { outputType, filter, limit = 10 } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, resourceGetter.schema);
        }

        let filterBy;
        if (filter) {
            try {
                filterBy = JSON.parse(filter);
            } catch (e) {
                throw new context.CancelError('Invalid Input: Filter', e);
            }
        }

        const records = await resourceGetter.getResources(context, { filterBy, limit });

        return lib.sendArrayOutput({ context, records, outputType });
    }
};

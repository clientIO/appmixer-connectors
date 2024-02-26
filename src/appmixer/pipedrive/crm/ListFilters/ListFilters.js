'use strict';
const commons = require('../../pipedrive-commons');

/**
 * ListFilters
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const filterType = context.messages.filterType.content;
        const filters = commons.getPromisifiedClient(context.auth.apiKey, 'Filters');
        const options = {
            type: filterType === 'all' ? undefined : filterType
        };

        return filters.getAllAsync(options)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (Array.isArray(response.data)) {
                    return context.sendJson(response.data.map(filter => filter.toObject()), 'out');
                }
            });
    }
};

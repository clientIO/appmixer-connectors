'use strict';
const commons = require('../../pipedrive-commons');

/**
 * ListPeople
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const pipelines = commons.getPromisifiedClient(context.auth.apiKey, 'Pipelines');
        return pipelines.getAllAsync()
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (Array.isArray(response.data)) {
                    return context.sendJson(response.data.map(pipeline => pipeline.toObject()), 'out');
                }
            });
    }
};

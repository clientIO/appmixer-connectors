'use strict';
const commons = require('../../pipedrive-commons');

/**
 * ListStages
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const stages = commons.getPromisifiedClient(context.auth.apiKey, 'Stages');

        return stages.getAllAsync()
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (Array.isArray(response.data)) {
                    return context.sendJson(response.data.map(stage => stage.toObject()), 'out');
                }
            });
    }
};

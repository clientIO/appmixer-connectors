'use strict';
const commons = require('../../pipedrive-commons');

/**
 * CreatePerson action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let data = context.messages.stage.content;
        const stages = commons.getPromisifiedClient(context.auth.apiKey, 'Stages');

        return stages.addAsync(data)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (response.success && response.data) {
                    return context.sendJson(response.data, 'newStage');
                }
            });
    }
};

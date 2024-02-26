'use strict';
const commons = require('../../pipedrive-commons');

/**
 * UpdateStage action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let data = context.messages.stage.content;
        const stages = commons.getPromisifiedClient(context.auth.apiKey, 'Stages');

        const id = data.id;
        delete data.id;

        return stages.updateAsync(id, data)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                return context.sendJson(response.data, 'updatedStage');
            });
    }
};

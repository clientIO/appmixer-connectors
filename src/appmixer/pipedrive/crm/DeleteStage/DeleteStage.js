'use strict';
const commons = require('../../pipedrive-commons');

/**
 * DeleteStage action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let data = context.messages.stage.content;
        const productsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Stages');

        return productsApi.removeAsync(data.id)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
            });
    }
};

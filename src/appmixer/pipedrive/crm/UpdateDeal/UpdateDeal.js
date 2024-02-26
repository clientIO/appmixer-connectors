'use strict';
const commons = require('../../pipedrive-commons');

/**
 * UpdateDeal action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let data = context.messages.deal.content;
        const personsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Deals');

        const id = data.id;
        delete data.id;

        return personsApi.updateAsync(id, data)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                return context.sendJson(response.data, 'updatedDeal');
            });
    }
};

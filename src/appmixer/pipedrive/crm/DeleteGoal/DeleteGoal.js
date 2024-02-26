'use strict';
const commons = require('../../pipedrive-commons');

/**
 * DeleteGoal action. This component is private now. 'goals' endpoint
 * does not work anymore in v1 API. Although it is still mentioned
 * in their pipedrive npm library.
 * They're blog says something about adding API support for goals soon, but
 * no exact date ...
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const data = context.messages.goal.content;
        const goalsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Goals');

        return goalsApi.removeAsync(data.id)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                return context.sendJson(response.data, 'deletedGoal');
            });
    }
};

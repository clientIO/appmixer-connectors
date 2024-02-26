const commons = require('../salesforce-commons');

module.exports = {

    async receive(context) {

        const {
            id,
            objectName
        } = context.messages.in.content;

        await commons.api.salesForceRq(context, {
            method: 'DELETE',
            action: `sobjects/${objectName}/${id}`
        });

        // http 204 No Content on success
        return context.sendJson({}, 'out');
    }
};


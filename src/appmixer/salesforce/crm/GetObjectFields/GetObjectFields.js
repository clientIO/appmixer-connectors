const commons = require('../salesforce-commons');

module.exports = {

    async receive(context) {

        const {
            objectName
        } = context.messages.in.content;

        return context.sendJson({
            fields: await commons.api.getObjectFields(context, { objectName })
        }, 'out');
    }
};

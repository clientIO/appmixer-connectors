const commons = require('../salesforce-commons');

module.exports = {

    async receive(context) {

        const {
            id,
            objectName
        } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, objectName);
        }

        const { data } = await commons.api.salesForceRq(context, {
            action: `sobjects/${objectName}/${id}`
        });

        return context.sendJson(data, 'out');
    },

    async getOutputPortOptions(context, objectName) {

        const fields = await commons.api.getObjectFields(context, { objectName });

        const output = fields.map(item => {

            return {
                label: item.label ? `${item.label} - (${item.name})` : item.name,
                value: item.name
            };
        });

        return context.sendJson(output, 'out');
    }
};


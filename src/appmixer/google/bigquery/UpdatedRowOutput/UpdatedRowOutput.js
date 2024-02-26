'use strict';

module.exports = {

    async receive(context) {

        const { recordOldValues } = context.properties;

        const variables = [{ "label": "Updated Row", "value": "updatedRow" }];
        if (recordOldValues) {
            variables.push({ "label": "Old Row", "value": "oldRow" })
        }
        return context.sendJson(variables, 'out');
    }
};

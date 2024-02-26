'use strict';
const commons = require('../salesforce-commons');

/**
 * Component for fetching list of contacts fields.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const client = commons.getSalesforceAPI(context);

        return client.sobject('Contact').describe()
            .then(res => {
                const fields = res.fields.map(field => ({
                    name: field.name,
                    label: field.label
                }));
                return context.sendJson({ fields }, 'out');
            });
    },

    fieldsToSelectArray({ fields }) {

        return fields.map(field => {
            return { label: field.label, value: field.name };
        });
    }
};


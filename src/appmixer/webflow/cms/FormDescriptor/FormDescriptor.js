'use strict';

/**
 * @extends {Component}
 */
module.exports = {
    async receive(context) {
        const token = context.auth.apiKey;
        const { formId } = context.properties;

        if (!formId) {
            return context.sendJson({ message: 'No form selected', siteId: context.properties.siteId }, 'out');
        }

        const formSchemaResponse = await context.httpRequest({
            url: `https://api.webflow.com/v2/forms/${formId}`,
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'accept-version': '2.0.0'
            }
        });

        const formSchema = formSchemaResponse.data;

        return context.sendJson(formSchema, 'out');
    },

    toSelectArray(formSchema) {
        const options = [
            { label: 'Form name', value: 'payload.name' },
            { label: 'Site ID', value: 'payload.siteId' }
        ];

        if (!formSchema || !formSchema.fields) {
            return options;
        }

        Object.entries(formSchema.fields).forEach(([, field]) => {
            options.push({
                label: field.displayName,
                value: `payload.data.${field.displayName}`
            });
        });

        return options;
    }
};

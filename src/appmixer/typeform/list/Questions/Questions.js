'use strict';
const typeFormApi = require('@typeform/api-client');

/**
 * Get info about form and the use questions property from result to create array
 * for select box used in UI.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const api = typeFormApi.createClient({ token: context.auth.accessToken });
        const form = await api.forms.get({ uid: context.properties.UID });
        return context.sendJson(form.fields, 'out');
    },

    toSelectArray(forms) {

        let transformed = [];
        transformed.push(
            {
                label: 'Submitted At',
                value: 'submittedAt'
            },
            {
                label: 'Landed At',
                value: 'landedAt'
            }
        );

        if (Array.isArray(forms)) {
            forms.forEach(form => {
                transformed.push({
                    label: form['title'],
                    value: `answers.${form['id']}`
                });
            });
        }

        return transformed;
    }
};

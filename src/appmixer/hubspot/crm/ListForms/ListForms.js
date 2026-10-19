'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const forms = [];
        let after;
        do {
            const params = { limit: 100 };
            if (after) {
                params.after = after;
            }
            const { data } = await hs.call('get', 'marketing/v3/forms', params);
            forms.push(...(data.results || []));
            after = data.paging?.next?.after;
        } while (after);

        return context.sendJson(forms, 'out');
    },

    formsToSelectArray(forms) {

        if (!Array.isArray(forms)) return [];
        return forms.map((form) => ({
            label: form.name || form.id,
            value: form.id
        }));
    }
};

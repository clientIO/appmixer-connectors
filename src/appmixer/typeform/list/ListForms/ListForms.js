'use strict';
const typeFormApi = require('@typeform/api-client');
const PagingAggregator = require('appmixer-lib').util.PagingAggregator;

const aggregator = new PagingAggregator(
    (args, page, pageSize) => {
        return args.api.forms.list({ page, pageSize });
    },
    (accumulator, chunk) => accumulator.concat(chunk['items']),
    (accumulator, chunk, page) => {
        const isDone = chunk['page_count'] === page || chunk['page_count'] === 0;
        return isDone ? -1 : page + 1;
    }
);

/**
 * Component for fetching list of forms
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const options = { api: typeFormApi.createClient({ token: context.auth.accessToken }) };
        const forms = await aggregator.fetch(options, 1, 200); // 200 is max
        return context.sendJson(forms, 'forms');
    },

    toSelectArray(forms) {

        let transformed = [];

        if (Array.isArray(forms)) {
            forms.forEach(form => {
                transformed.push({
                    label: form['title'],
                    value: form['id']
                });
            });
        }

        return transformed;
    }
};

'use strict';

const lib = require('../../lib');

// The API default; Appmixer components do not expose limit/offset pagination
// controls, so the cap is fixed and documented in the component description.
const MAP_LIMIT = 5000;

const schema = {
    'url': { 'type': 'string', 'title': 'URL' },
    'title': { 'type': 'string', 'title': 'Title' },
    'description': { 'type': 'string', 'title': 'Description' }
};

module.exports = {

    async receive(context) {

        const {
            url,
            search,
            sitemap,
            includeSubdomains,
            ignoreQueryParameters,
            outputType
        } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Links' });
        }

        if (!url) {
            throw new context.CancelError('URL is required!');
        }

        const payload = { url, limit: MAP_LIMIT };

        if (search) {
            payload.search = search;
        }
        if (sitemap && sitemap !== 'include') {
            payload.sitemap = sitemap;
        }
        // The API defaults to true for both flags; only send them when the user
        // turned them off. Toggle values can reach the component as the string
        // 'false'.
        if (includeSubdomains === false || includeSubdomains === 'false') {
            payload.includeSubdomains = false;
        }
        if (ignoreQueryParameters === false || ignoreQueryParameters === 'false') {
            payload.ignoreQueryParameters = false;
        }

        const response = await lib.makeRequest({
            context,
            method: 'POST',
            path: '/v2/map',
            data: payload
        });

        const records = ((response && response.links) || []).map(link => ({
            url: link.url,
            title: link.title,
            description: link.description
        }));

        return lib.sendArrayOutput({ context, records, outputType });
    }
};

'use strict';

const lib = require('../../lib');

// The map endpoint returns a flat array of URL strings. We wrap each one in an
// object so the array/object/first/file output types all behave consistently.
const schema = {
    'url': { 'type': 'string', 'title': 'URL', 'example': 'https://docs.tavily.com/documentation/quickstart' }
};

module.exports = {
    async receive(context) {

        const {
            url,
            instructions,
            maxDepth,
            maxBreadth,
            maxPages,
            selectPaths,
            excludePaths,
            selectDomains,
            excludeDomains,
            allowExternal,
            outputType
        } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Links' });
        }

        if (!url) {
            throw new context.CancelError('URL is required!');
        }

        const data = { url };

        if (instructions) {
            data.instructions = instructions;
        }
        if (maxDepth) {
            data.max_depth = maxDepth;
        }
        if (maxBreadth) {
            data.max_breadth = maxBreadth;
        }
        if (maxPages) {
            data.limit = maxPages;
        }
        // allowExternal defaults to true upstream, so only send it when the user
        // explicitly turned it off.
        if (allowExternal === false) {
            data.allow_external = false;
        }

        // These four take regular expressions, one per line. They are split on
        // newlines only - a comma is a legal part of a pattern (`a{1,3}`).
        const regexInputs = {
            select_paths: selectPaths,
            exclude_paths: excludePaths,
            select_domains: selectDomains,
            exclude_domains: excludeDomains
        };
        Object.keys(regexInputs).forEach(key => {
            const value = lib.toLines(regexInputs[key]);
            if (value) {
                data[key] = value;
            }
        });

        const response = await lib.makeRequest({ context, path: '/map', data });
        const links = (response && response.results) || [];

        if (links.length === 0) {
            return context.sendJson({ url }, 'notFound');
        }

        const records = links.map(link => ({ url: link }));

        return lib.sendArrayOutput({ context, records, outputType });
    }
};

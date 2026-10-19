'use strict';

const pathModule = require('path');

const API_BASE_URL = 'https://api.firecrawl.dev';
const DEFAULT_PREFIX = 'firecrawl-objects-export';

// Safety cap on the number of `next` pages followed when collecting crawl
// results (each page holds up to 10 MB of data).
const MAX_RESULT_PAGES = 20;

module.exports = {

    API_BASE_URL,

    /**
     * Resolve a user supplied endpoint (relative path or absolute URL) against
     * the Firecrawl API base and refuse anything that would send the account's
     * API key somewhere else.
     *
     * Resolving through the WHATWG URL parser and then comparing the resulting
     * origin also rejects protocol-relative input such as `//example.com/x`,
     * which would otherwise silently resolve to a foreign host.
     * @param {object} context Appmixer component context (for CancelError)
     * @param {string} url relative path (e.g. '/v2/scrape') or absolute Firecrawl URL
     * @returns {string} absolute URL on the Firecrawl API host
     */
    resolveApiUrl(context, url) {

        const candidate = /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')
            ? url
            : `${url.startsWith('/') ? '' : '/'}${url}`;

        let parsed;
        try {
            parsed = new URL(candidate, API_BASE_URL);
        } catch (error) {
            throw new context.CancelError(`API Endpoint Path is not a valid URL: ${url}`);
        }

        if (parsed.username || parsed.password) {
            throw new context.CancelError('API Endpoint Path must not contain credentials.');
        }

        if (parsed.origin !== API_BASE_URL) {
            throw new context.CancelError(
                `API Endpoint Path must target ${API_BASE_URL}, got ${parsed.origin}.`
            );
        }

        return parsed.toString();
    },

    /**
     * Thin wrapper around context.httpRequest that applies the Firecrawl auth
     * header and returns the parsed response body. context.httpRequest throws
     * on non-2xx responses, so callers can rely on the body being present.
     * @param {object} args
     * @param {object} args.context Appmixer component context (needs `auth.apiKey`)
     * @param {string} [args.method] HTTP method (default GET)
     * @param {string} args.path API path starting with a slash (e.g. '/v2/scrape')
     * @param {object} [args.data] JSON request body
     * @param {object} [args.params] Query parameters
     * @returns {Promise<object>} the parsed response body
     */
    async makeRequest({ context, method = 'GET', path, data = null, params = null }) {

        const options = {
            method,
            url: API_BASE_URL + path,
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`
            }
        };

        if (data) {
            options.data = data;
            options.headers['Content-Type'] = 'application/json';
        }
        if (params) {
            options.params = params;
        }

        const response = await context.httpRequest(options);
        return response ? response.data : null;
    },

    /**
     * Split a comma or newline separated string into a trimmed array.
     * @param {string} value
     * @returns {string[]}
     */
    parseList(value) {

        if (!value) {
            return [];
        }
        return String(value)
            .split(/[,\n]/)
            .map(item => item.trim())
            .filter(Boolean);
    },

    /**
     * Read a toggle input. A toggle can reach a component as a real boolean or as
     * the string 'true' / 'false', and the string 'false' is truthy - so every
     * toggle has to be compared explicitly rather than tested for truthiness.
     * @param {boolean|string|undefined} value
     * @returns {boolean} true only when the toggle is explicitly on
     */
    isOn(value) {

        return value === true || value === 'true';
    },

    /**
     * The counterpart of `isOn`, for flags the API defaults to true: only an
     * explicit "off" is worth sending.
     * @param {boolean|string|undefined} value
     * @returns {boolean} true only when the toggle is explicitly off
     */
    isOff(value) {

        return value === false || value === 'false';
    },

    /**
     * Fetch a crawl job's status and, when it is completed, follow the `next`
     * pagination links to collect the full result set. Shared by CrawlWebsite and
     * GetCrawlStatus so the two cannot drift apart.
     * @param {object} context Appmixer component context
     * @param {string} jobId
     * @returns {Promise<object>} the job payload with `data` collected and a
     *   `truncated` flag telling whether the page cap was hit
     */
    async getCrawlJob(context, jobId) {

        const job = await module.exports.makeRequest({
            context,
            method: 'GET',
            path: `/v2/crawl/${jobId}`
        });

        const data = (job && job.data) || [];
        let next = job && job.next;
        let pagesFollowed = 0;

        while (next && job.status === 'completed' && pagesFollowed < MAX_RESULT_PAGES) {
            // `next` is an absolute URL on the Firecrawl API host.
            const page = await module.exports.makeRequest({
                context,
                path: String(next).replace(API_BASE_URL, '')
            });
            data.push(...((page && page.data) || []));
            next = page && page.next;
            pagesFollowed++;
        }

        // Stopping on the cap while `next` still points somewhere means pages were
        // dropped. Say so, rather than handing back a silently partial result.
        const truncated = Boolean(next) && job && job.status === 'completed';

        if (truncated) {
            await context.log({
                step: 'Crawl result truncated',
                jobId,
                pagesFollowed,
                maxResultPages: MAX_RESULT_PAGES,
                message: 'The crawl returned more result pages than this component collects. '
                    + 'Narrow the crawl with Max Pages or Include Paths to get a complete result.'
            });
        }

        return { ...job, data, truncated };
    },

    /**
     * Reduce a scraped page to the fields declared in the output port schema so
     * flows do not carry the full raw payload of every page.
     * @param {object} page
     * @returns {object}
     */
    toPageOutput(page) {

        const metadata = (page && page.metadata) || {};

        return {
            markdown: page && page.markdown,
            metadata: {
                title: metadata.title,
                sourceURL: metadata.sourceURL,
                statusCode: metadata.statusCode
            }
        };
    },

    async sendArrayOutput({
        context,
        outputPortName = 'out',
        outputType = 'array',
        records = []
    }) {

        if (outputType === 'first') {
            if (records.length === 0) {
                throw new context.CancelError('No records available for first output type');
            }
            await context.sendJson(
                { ...records[0], index: 0, count: records.length },
                outputPortName
            );
        } else if (outputType === 'object') {
            for (let index = 0; index < records.length; index++) {
                await context.sendJson(
                    { ...records[index], index, count: records.length },
                    outputPortName
                );
            }
        } else if (outputType === 'array') {
            await context.sendJson({ result: records, count: records.length }, outputPortName);
        } else if (outputType === 'file') {

            const csvString = toCsv(records);
            const buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || DEFAULT_PREFIX}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);

            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    getOutputPortOptions(context, outputType, itemSchema, { label }) {

        if (outputType === 'object' || outputType === 'first') {
            const options = Object.keys(itemSchema)
                .reduce((res, field) => {
                    const schema = itemSchema[field];
                    const { title: fieldLabel, ...schemaWithoutTitle } = schema;

                    res.push({
                        label: fieldLabel, value: field, schema: schemaWithoutTitle
                    });
                    return res;
                }, [{
                    label: 'Current Item Index',
                    value: 'index',
                    schema: { type: 'integer' }
                }, {
                    label: 'Items Count',
                    value: 'count',
                    schema: { type: 'integer' }
                }]);

            return context.sendJson(options, 'out');
        }

        if (outputType === 'array') {
            return context.sendJson([{
                label: 'Items Count',
                value: 'count',
                schema: { type: 'integer' }
            }, {
                label: label,
                value: 'result',
                schema: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: itemSchema
                    }
                }
            }], 'out');
        }

        if (outputType === 'file') {
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};

/**
 * @param {array} array
 * @returns {string}
 */
const toCsv = (array) => {

    if (!array.length) {
        return '';
    }

    const headers = Object.keys(array[0]);

    return [
        headers.join(','),

        ...array.map(items => {
            return Object.values(items).map(property => {
                if (typeof property === 'object') {
                    return JSON.stringify(property);
                }
                return property;
            }).join(',');
        })

    ].join('\n');
};

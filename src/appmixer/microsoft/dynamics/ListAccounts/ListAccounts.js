/* eslint-disable camelcase */
'use strict';

const { sendArrayOutput } = require('../../microsoft-commons');

const PAGE_SIZE = 100;

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const {
            // Filter paramters
            name, telephone1, address1_city, emailaddress1, maxRecords,

            // Supports the OData Query Parameters that don't change the shape of the response.
            // Note that `$filter` is not supported here, use MakeApiCall instead.
            orderBy,

            // Appmixer specific
            outputType
        } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const url = (context.resource || context.auth.resource) + '/api/data/v9.2/accounts';
        // Query params
        const urlWithQueryParams = new URL(url);
        const filterQueries = [];
        if (name) {
            filterQueries.push(`contains(name,'${name}')`);
        }
        if (telephone1) {
            filterQueries.push(`contains(telephone1,'${telephone1}')`);
        }
        if (address1_city) {
            filterQueries.push(`contains(address1_city,'${address1_city}')`);
        }
        if (emailaddress1) {
            filterQueries.push(`contains(emailaddress1,'${emailaddress1}')`);
        }
        if (filterQueries.length > 0) {
            urlWithQueryParams.searchParams.append('$filter', filterQueries.join(' and '));
        }

        if (orderBy) {
            urlWithQueryParams.searchParams.append('$orderby', orderBy);
        }

        const options = {
            url: urlWithQueryParams,
            headers: {
                Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`,
                accept: 'application/json'
            }
        };

        const MAX_LIMIT = maxRecords || 1000;
        let totalRecords = 0;
        let records = [];
        let nextLink = null;
        do {
            options.params = {
                $top: Math.min(PAGE_SIZE, MAX_LIMIT - totalRecords),
                nextLink
            };
            context.log({ step: 'Making request', options });

            const { data: result } = await context.httpRequest(options);
            records = records.concat(result.value);
            nextLink = result['@odata.nextLink'];
            totalRecords += result.value.length;
        } while (nextLink && totalRecords < MAX_LIMIT);

        if (records.length === 0) {
            return await context.sendJson({ messages: 'No data returned.', options }, 'emptyResult');
        }

        return await sendArrayOutput({ context, outputType, records });
    }
};

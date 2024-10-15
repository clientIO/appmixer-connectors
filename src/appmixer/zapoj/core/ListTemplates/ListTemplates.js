/* eslint-disable camelcase */
'use strict';

const { sendArrayOutput, getOutputPortOptions } = require('../../lib');
const itemSchemaWithTitles = require('./itemSchema');

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        let { outputType, limit = 1000, type } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return getOutputPortOptions(context, outputType, itemSchemaWithTitles);
        }

        const url = `https://messagetemplate.${context.auth?.subdomain}.zapoj.com/api/itTemplate/list/NI/${type}`;

        // Get first page.
        const { data } = await context.httpRequest({
            url,
            headers: {
                authorization: `Bearer ${context.auth?.token}`
            }
        });

        let incidents = data.messages.notification.data || [];
        let { current_page = 1, last_page = null, to } = data.messages?.notification;
        // Failsafe in case the 3rd party API doesn't behave correctly, to prevent infinite loop.
        let failsafe = 0;

        while (current_page < last_page && failsafe < limit && to < limit) {
            const { data: nextPageData } = await context.httpRequest({
                url: `${url}?page=${current_page + 1}`,
                headers: {
                    authorization: `Bearer ${context.auth?.token}`
                }
            });


            to = nextPageData.messages.notification.to;
            incidents = incidents.concat(nextPageData.messages.notification.data);
            current_page = nextPageData.messages.notification.current_page;
            failsafe += 1;
        }

        // Slice the array to the limit. Currently there is no way to limit the number of records in the API call.
        incidents = incidents.slice(0, limit);

        await sendArrayOutput({ context, outputType, records: incidents });
    }
};

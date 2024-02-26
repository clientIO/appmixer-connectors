'use strict';
const { makeRequest } = require('../../commons');

module.exports = {

    async receive(context) {

        const filters = context.messages.in.content.filter.AND;
        let condition = '';
        for (const filter of filters) {
            condition = condition ? condition + ' AND ' : '';
            condition += `${filter.property}  ${filter.operator} '${filter.value}'`;
        }
        const query = `SELECT * FROM Customer WHERE ${condition} MAXRESULTS 1`;
        const options = {
            path: `v3/company/${context.profileInfo.companyId}/query?query=${encodeURIComponent(query)}`,
            method: 'GET'
        };

        context.log({ step: 'Making request', options });
        const response = await makeRequest({ context, options });

        const customers = response.data.QueryResponse.Customer || [];
        if (customers.length === 0) {
            return await context.sendJson({ query }, 'notFound');
        }

        return context.sendJson({ Customer: customers[0] }, 'out');
    }
};


'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {
        let { searchTerm, customfields } = context.messages.in.content;
        let q = {}
        if (searchTerm !== null && searchTerm !== undefined) {
            q.searchTerm = searchTerm;
        }

        // Add custom fields if they're set
        if (customfields?.AND?.length > 0) {
            for (let cf of customfields.AND) {
                let id = cf.name.split('-')[0];
                let type = cf.name.split('-')[1];

                if (type === 'number') {
                    if (!Number.isInteger(+cf.value)) {
                        throw new Error(`Invalid value "${cf.value}" for number custom field`);
                    }
                    cf.value = parseInt(cf.value, 10);
                }

                q[`customField[${id}][eq]`] = cf.value;
            }
        }

        let allCompanies = [];
        let page = 1;
        let pageSize = 500;
        let hasMore = true;
        try {
            while (hasMore) {
                q.page = page;
                q.pageSize = pageSize;

                let resp = await lib.callAPI(
                    context,
                    "GET",
                    '/projects/api/v3/companies.json',
                    null,
                    q
                );

                if (resp && Array.isArray(resp.companies)) {
                    allCompanies = allCompanies.concat(resp.companies);
                } else {
                    throw new Error('Invalid API response structure');
                }

                hasMore = resp.meta?.page?.hasMore || false;
                page++;
            }
        } catch (error) {
            throw new Error(`Error fetching companies: ${error.message}`);
        }

        return context.sendJson({ companies: allCompanies }, 'companies');
    },

    toInspector: function(data) { 
        let transformed = [];
        if (data && Array.isArray(data.companies)) {
            data.companies.forEach(company => {
                transformed.push({
                    label: company.name,
                    value: company.id.toString()
                });
            });
        }
        return transformed;
    }

}

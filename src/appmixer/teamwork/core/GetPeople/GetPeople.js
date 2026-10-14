'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {
        let { people } = context.messages.in.content;
        let q = {}

        q.ids = people

        let allPeople = [];
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
                    '/projects/api/v3/people.json',
                    null,
                    q
                );

                if (resp && Array.isArray(resp.people)) {
                    allPeople = allPeople.concat(resp.people);
                } else {
                    throw new Error('Invalid API response structure');
                }

                hasMore = resp.meta?.page?.hasMore || false;
                page++;
            }
        } catch (error) {
            throw new Error(`Error fetching people: ${error.message}`);
        }

        return context.sendJson({ people: allPeople }, 'people');
    },

    toInspector: function(data){
        let transformed = [];
        if (Array.isArray(data.people)) {
            data.people.forEach(person => {
                transformed.push({
                    label: `${person['firstName']} ${person['lastName']}`,
                    value: person['id'].toString()
                });
            });
        }

        return transformed;
    }

}

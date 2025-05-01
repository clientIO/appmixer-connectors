'use strict';
const lib = require('../../lib');

const query = `query Lists($page: Int, $perPage: Int) {
    lists(
      filter: { listStatus: ACTIVE },
      page: $page,
      perPage: $perPage
    ) {
      entries {
        id
        name
        contactsCount
        createdAt
        updatedAt
        creator {
          id
          email
        }
      }
      pageInfo {
        totalEntries
        totalPages
      }
    }
}`;

module.exports = {
    async receive(context) {
        const page = 1;
        const perPage = 1;
        const allResults = [];
        let currentPage = page;
        let totalPages;

        do {
            const { data } = await lib.makeApiCall({
                context,
                method: 'POST',
                data: { query, variables: { page: currentPage, perPage } }
            });

            if (data.errors) {
                throw new context.CancelError(data.errors);
            }

            const result = data.data.lists.entries;
            totalPages = data.data.lists.pageInfo.totalPages;

            allResults.push(...result);
            console.log(`Page ${currentPage} of ${totalPages} processed.`);
            currentPage++;
        } while (currentPage <= totalPages);

        return context.sendJson(allResults, 'out');
    },

    listsToSelectArray(lists) {
        return lists.map(list => {
            return { label: `${list.name}`, value: `${list.id}` };
        });
    }
};

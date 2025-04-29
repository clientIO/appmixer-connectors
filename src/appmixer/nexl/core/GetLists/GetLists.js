'use strict';
const lib = require('../../lib');

const query = `query {
    lists(
      filter: { listStatus: ACTIVE },
      page: 1,
      perPage: 500
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
        const response = await lib.makeApiCall({
            context,
            method: 'POST',
            data: { query }
        });

        if (response.data.errors) {
            throw new context.CancelError(response.data.data.errors);
        }
        console.log(response.data.data);
        const lists = response.data.data.lists.entries;
        return context.sendJson(lists, 'out');
    },

    listsToSelectArray(lists) {

        return lists.map(list => {
            return { label: `${list.name}`, value: `${list.id}` };
        });
    }
};

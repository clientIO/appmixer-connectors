'use strict';

const lib = require('../../lib');

const query = `query ListMembers($uid: ID!, $page: Int, $perPage: Int) {
    listMembers(
        uid: $uid,
        page: $page,
        perPage: $perPage,
        orderBy: CREATED_AT_DESC,
        withMissingFields: false
    ) {
        entries {
            id
            listId
            updatedAt
            createdAt
            completedTasksCount
            tasksCount
            discardedAt
            contact {
                id
                primaryEmail
                isActive
                isArchived
                isKeyContact
                createdAt
                updatedAt
                emailAddresses
            }
            creator {
                id
                firstName
                lastName
                email
            }
            remover {
                id
                firstName
                lastName
                email
            }
            customFields {
                id
                name
                value
            }
            listReminders {
                id
            }
        }
        pageInfo {
            totalEntries
            totalPages
        }
    }
}`;

/**
 * Fetch a single page of list members (newest first). Shared by tick() and test().
 * @param {Object} context
 * @param {string} uid
 * @param {number} page
 * @param {number} perPage
 * @returns {Promise<{ entries: Array, totalPages: number }>}
 */
async function fetchListMembersPage(context, uid, page, perPage) {
    const { data } = await lib.makeApiCall({
        context,
        method: 'POST',
        data: { query, variables: { uid, page, perPage } }
    });

    if (data.errors) {
        throw new context.CancelError(data.errors);
    }

    return {
        entries: data.data.listMembers.entries,
        totalPages: data.data.listMembers.pageInfo.totalPages
    };
}

module.exports = {
    async tick(context) {
        const { uid } = context.properties;
        const page = 1;
        const perPage = 500;

        const allResults = [];
        let currentPage = page;
        let totalPages;

        do {
            const { entries, totalPages: pages } = await fetchListMembersPage(context, uid, currentPage, perPage);

            totalPages = pages;
            allResults.push(...entries);
            currentPage++;
        } while (currentPage <= totalPages);

        const knownContactsRaw = context.state.knownContacts;
        const isFirstRun = !Array.isArray(knownContactsRaw);
        const knownContacts = isFirstRun ? new Set() : new Set(knownContactsRaw);
        const currentContacts = allResults.map(contact => contact.id);

        const newContacts = allResults.filter(contact => !knownContacts.has(contact.id));

        await context.saveState({ knownContacts: currentContacts });

        if (!isFirstRun && newContacts.length > 0) {
            await Promise.all(newContacts.map(contact => {
                return context.sendJson(contact, 'out');
            }));
        }

    },

    async test(context) {
        const { uid } = context.properties;
        if (!uid) {
            throw new context.CancelError('List UID is required!');
        }

        // Fetch only the newest member (query orders by CREATED_AT_DESC) without
        // the state baseline, so a real example is emitted in the same shape and
        // port as tick().
        const { entries } = await fetchListMembersPage(context, uid, 1, 1);
        if (!entries || !entries.length) {
            throw new Error('No contacts in the list to use as test data.');
        }
        return context.sendJson(entries[0], 'out');
    }
};

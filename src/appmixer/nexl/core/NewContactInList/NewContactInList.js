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

module.exports = {
    async tick(context) {
        const { uid } = context.properties;
        const page = 1;
        const perPage = 500;

        const allResults = [];
        let currentPage = page;
        let totalPages;

        do {
            const { data } = await lib.makeApiCall({
                context,
                method: 'POST',
                data: { query, variables: { uid, page: currentPage, perPage } }
            });

            if (data.errors) {
                throw new context.CancelError(data.errors);
            }

            const result = data.data.listMembers.entries;
            totalPages = data.data.listMembers.pageInfo.totalPages;

            allResults.push(...result);
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
        
    }
};

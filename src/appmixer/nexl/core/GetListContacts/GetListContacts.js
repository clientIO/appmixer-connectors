'use strict';

const lib = require('../../lib');
const { sendArrayOutput } = require('../../lib');

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
    async receive(context) {
        const { uid, outputType } = context.messages.in.content;
        const page = 1;
        const perPage = 500;
        const { generateOutputPortOptions } = context.properties;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

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

        return sendArrayOutput({ context, outputType, records: allResults });
    },

    getOutputPortOptions(context, outputType) {
        if (outputType === 'first' || outputType === 'object') {
            return context.sendJson([
                { label: 'Current Member Index', value: 'index', schema: { type: 'integer' } },
                { label: 'Total Members', value: 'count', schema: { type: 'integer' } },
                { label: 'List Member', value: 'contact', schema: this.listMemberSchema }
            ], 'out');
        }

        if (outputType === 'array') {
            return context.sendJson([
                { label: 'Total Members', value: 'count', schema: { type: 'integer' } },
                {
                    label: 'List Members',
                    value: 'contacts',
                    schema: {
                        type: 'array',
                        items: this.listMemberSchema
                    }
                }
            ], 'out');
        }

        return context.sendJson([
            { label: 'File ID', value: 'fileId' },
            { label: 'Total Members', value: 'count', schema: { type: 'integer' } }
        ], 'out');
    },

    listMemberSchema: {
        type: 'object',
        properties: {
            id: { type: 'string', title: 'List Member ID' },
            listId: { type: 'string', title: 'List ID' },
            updatedAt: { type: 'string', title: 'Updated At' },
            createdAt: { type: 'string', title: 'Created At' },
            completedTasksCount: { type: 'number', title: 'Completed Tasks Count' },
            tasksCount: { type: 'number', title: 'Tasks Count' },
            discardedAt: { type: 'string', title: 'Discarded At' },
            contact: {
                type: 'object',
                title: 'Contact Info',
                properties: {
                    id: { type: 'string', title: 'Contact ID' },
                    primaryEmail: { type: 'string', format: 'email', title: 'Primary Email' },
                    isActive: { type: 'string', title: 'Is Active' },
                    isArchived: { type: 'string', title: 'Is Archived' },
                    isKeyContact: { type: 'string', title: 'Is Key Contact' },
                    createdAt: { type: 'string', title: 'Contact Created At' },
                    updatedAt: { type: 'string', title: 'Contact Updated At' },
                    emailAddresses: {
                        type: 'array',
                        title: 'Email Addresses',
                        items: { type: 'string', format: 'email' }
                    }
                }
            },
            creator: {
                type: 'object',
                title: 'Creator Info',
                properties: {
                    id: { type: 'string', title: 'Creator ID' },
                    firstName: { type: 'string', title: 'First Name' },
                    lastName: { type: 'string', title: 'Last Name' },
                    email: { type: 'string', format: 'email', title: 'Creator Email' }
                }
            },
            remover: {
                type: 'array',
                title: 'Remover Info'
            },
            customFields: {
                type: 'array',
                title: 'Custom Fields',
                items: { type: 'object' }
            },
            listReminders: {
                type: 'array',
                title: 'List Reminders',
                items: { type: 'object' }
            }
        }
    }
};

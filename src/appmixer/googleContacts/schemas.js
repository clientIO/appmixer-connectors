const personSchema = {
    id: { type: 'string', title: 'Contact ID' },
    etag: { type: 'string', title: 'ETag' },
    updateTime: { type: 'string', title: 'UpdateTime' },
    displayName: { type: 'string', title: 'DisplayName' },
    givenName: { type: 'string', title: 'GivenName' },
    displayNameLastFirst: { type: 'string', title: 'DisplayNameLastFirst' },
    unstructuredName: { type: 'string', title: 'UnstructuredName' },
    photoUrl: { type: 'string', title: 'PhotoUrl' },
    memberships: {
        type: 'array',
        title: 'Memberships',
        items: {
            type: 'object',
            properties: {
                metadata: {
                    type: 'object',
                    properties: {
                        source: {
                            type: 'object',
                            properties: {
                                type: { type: 'string', title: 'Memberships.Metadata.Source.Type' },
                                id: { type: 'string', title: 'Memberships.Metadata.Source.Id' }
                            }
                        }
                    }
                },
                contactGroupMembership: {
                    type: 'object',
                    properties: {
                        contactGroupId: { type: 'string', title: 'Memberships.ContactGroupMembership.ContactGroupId' },
                        contactGroupResourceName: { type: 'string', title: 'Memberships.ContactGroupMembership.ContactGroupResourceName' }
                    }
                }
            }
        }
    }
};

const contactGroupSchema = {
    'id': { 'type': 'string', 'title': 'Contact Group ID' },
    'etag': { 'type': 'string', 'title': 'ETag' },
    'updateTime': { 'type': 'string', 'title': 'Update Time' },
    'groupType': { 'type': 'string', 'title': 'Group Type' },
    'name': { 'type': 'string', 'title': 'Name' },
    'formattedName': { 'type': 'string', 'title': 'Formatted Name' }
};

module.exports = {
    personSchema,
    contactGroupSchema
};

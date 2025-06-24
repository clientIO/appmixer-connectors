'use strict';

const lib = require('../../lib.generated');
const schema = {
    'lastModifyingUser': {
        'type': 'object',
        'properties': {
            'displayName': { 'type': 'string', 'title': 'Last Modifying User.Display Name' },
            'kind': { 'type': 'string', 'title': 'Last Modifying User.Kind' },
            'me': { 'type': 'boolean', 'title': 'Last Modifying User.Me' },
            'permissionId': { 'type': 'string', 'title': 'Last Modifying User.Permission Id' },
            'emailAddress': { 'type': 'string', 'title': 'Last Modifying User.Email Address' },
            'photoLink': { 'type': 'string', 'title': 'Last Modifying User.Photo Link' }
        },
        'title': 'Last Modifying User'
    },
    'owners': {
        'type': 'array',
        'items': {
            'type': 'object',
            'properties': {
                'displayName': { 'type': 'string', 'title': 'Owners.Display Name' },
                'kind': { 'type': 'string', 'title': 'Owners.Kind' },
                'me': { 'type': 'boolean', 'title': 'Owners.Me' },
                'permissionId': { 'type': 'string', 'title': 'Owners.Permission Id' },
                'emailAddress': { 'type': 'string', 'title': 'Owners.Email Address' },
                'photoLink': { 'type': 'string', 'title': 'Owners.Photo Link' }
            }
        },
        'title': 'Owners'
    },
    'capabilities': {
        'type': 'object', 'properties': {
            'canAcceptOwnership': { 'type': 'boolean', 'title': 'Capabilities.Can Accept Ownership' },
            'canAddChildren': { 'type': 'boolean', 'title': 'Capabilities.Can Add Children' },
            'canAddMyDriveParent': { 'type': 'boolean', 'title': 'Capabilities.Can Add My Drive Parent' },
            'canChangeCopyRequiresWriterPermission': {
                'type': 'boolean',
                'title': 'Capabilities.Can Change Copy Requires Writer Permission'
            },
            'canChangeSecurityUpdateEnabled': {
                'type': 'boolean',
                'title': 'Capabilities.Can Change Security Update Enabled'
            },
            'canChangeViewersCanCopyContent': {
                'type': 'boolean',
                'title': 'Capabilities.Can Change Viewers Can Copy Content'
            },
            'canComment': { 'type': 'boolean', 'title': 'Capabilities.Can Comment' },
            'canCopy': { 'type': 'boolean', 'title': 'Capabilities.Can Copy' },
            'canDelete': { 'type': 'boolean', 'title': 'Capabilities.Can Delete' },
            'canDisableInheritedPermissions': {
                'type': 'boolean',
                'title': 'Capabilities.Can Disable Inherited Permissions'
            },
            'canDownload': { 'type': 'boolean', 'title': 'Capabilities.Can Download' },
            'canEdit': { 'type': 'boolean', 'title': 'Capabilities.Can Edit' },
            'canEnableInheritedPermissions': {
                'type': 'boolean',
                'title': 'Capabilities.Can Enable Inherited Permissions'
            },
            'canListChildren': { 'type': 'boolean', 'title': 'Capabilities.Can List Children' },
            'canModifyContent': { 'type': 'boolean', 'title': 'Capabilities.Can Modify Content' },
            'canModifyContentRestriction': {
                'type': 'boolean',
                'title': 'Capabilities.Can Modify Content Restriction'
            },
            'canModifyEditorContentRestriction': {
                'type': 'boolean',
                'title': 'Capabilities.Can Modify Editor Content Restriction'
            },
            'canModifyOwnerContentRestriction': {
                'type': 'boolean',
                'title': 'Capabilities.Can Modify Owner Content Restriction'
            },
            'canModifyLabels': { 'type': 'boolean', 'title': 'Capabilities.Can Modify Labels' },
            'canMoveChildrenWithinDrive': { 'type': 'boolean', 'title': 'Capabilities.Can Move Children Within Drive' },
            'canMoveItemIntoTeamDrive': { 'type': 'boolean', 'title': 'Capabilities.Can Move Item Into Team Drive' },
            'canMoveItemOutOfDrive': { 'type': 'boolean', 'title': 'Capabilities.Can Move Item Out Of Drive' },
            'canMoveItemWithinDrive': { 'type': 'boolean', 'title': 'Capabilities.Can Move Item Within Drive' },
            'canReadLabels': { 'type': 'boolean', 'title': 'Capabilities.Can Read Labels' },
            'canReadRevisions': { 'type': 'boolean', 'title': 'Capabilities.Can Read Revisions' },
            'canRemoveChildren': { 'type': 'boolean', 'title': 'Capabilities.Can Remove Children' },
            'canRemoveContentRestriction': {
                'type': 'boolean',
                'title': 'Capabilities.Can Remove Content Restriction'
            },
            'canRemoveMyDriveParent': { 'type': 'boolean', 'title': 'Capabilities.Can Remove My Drive Parent' },
            'canRename': { 'type': 'boolean', 'title': 'Capabilities.Can Rename' },
            'canShare': { 'type': 'boolean', 'title': 'Capabilities.Can Share' },
            'canTrash': { 'type': 'boolean', 'title': 'Capabilities.Can Trash' },
            'canUntrash': { 'type': 'boolean', 'title': 'Capabilities.Can Untrash' }
        }, 'title': 'Capabilities'
    },
    'id': { 'type': 'string', 'title': 'Id' },
    'name': { 'type': 'string', 'title': 'Name' },
    'mimeType': { 'type': 'string', 'title': 'Mime Type' },
    'webViewLink': { 'type': 'string', 'title': 'Web View Link' },
    'iconLink': { 'type': 'string', 'title': 'Icon Link' },
    'thumbnailLink': { 'type': 'string', 'title': 'Thumbnail Link' },
    'createdTime': { 'type': 'string', 'title': 'Created Time' },
    'modifiedTime': { 'type': 'string', 'title': 'Modified Time' },
    'shared': { 'type': 'boolean', 'title': 'Shared' },
    'ownedByMe': { 'type': 'boolean', 'title': 'Owned By Me' }
};

module.exports = {

    async receive(context) {
        const orderBy = 'modifiedTime desc';
        const {
            searchQuery,
            outputType
        } = context.messages.in.content;

        // No need for generateOutputPortOptions logic since we use static options

        // Build query for Google Drive API to find Google Forms
        let query = 'mimeType=\'application/vnd.google-apps.form\'';

        // Add search query if provided
        if (searchQuery) {
            query += ` and name contains '${searchQuery.replace(/'/g, '\\\'')}'`;
        }

        // Build request parameters
        const params = {
            q: query,
            // pageSize: validPageSize,
            orderBy: orderBy,
            fields: 'nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,webViewLink,iconLink,thumbnailLink,owners,lastModifyingUser,shared,ownedByMe,capabilities)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        };

        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://www.googleapis.com/drive/v3/files',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            params: params
        });

        // Calculate total forms and whether there are more pages
        const forms = data.files || [];

        return lib.sendArrayOutput({ context, records: forms, outputType });
    }
};
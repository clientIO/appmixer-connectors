const lib = require('../lib.generated');

module.exports = {
    async receive(context) {
        const { folderLocation, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Presentations', value: 'result' });
        }

        let folderId;
        if (folderLocation) {
            folderId = typeof folderLocation === 'string' ? folderLocation : folderLocation.id;
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://www.googleapis.com/drive/v3/files',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            params: {
                fields: '*',
                pageSize: 1000,
                q: `mimeType = 'application/vnd.google-apps.presentation' and trashed = false and '${folderId ?? 'root'}' in parents`,
                supportsAllDrives: true
            }
        });

        return lib.sendArrayOutput({ context, records: data.files, outputType });
    }
};

const schema = {
    exportLinks: {
        type: 'object',
        title: 'Export Links',
        properties: {
            'application/vnd.oasis.opendocument.presentation': {
                type: 'string',
                title: 'Export Links.Application.Vnd.Oasis.Opendocument.Presentation'
            },
            'application/pdf': {
                type: 'string',
                title: 'Export Links.Application.Pdf'
            },
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
                type: 'string',
                title: 'Export Links.Application.Vnd.Openxmlformats-Officedocument.Presentationml.Presentation'
            },
            'text/plain': {
                type: 'string',
                title: 'Export Links.Text.Plain'
            }
        }
    },
    parents: {
        type: 'array',
        title: 'Parents',
        items: {
            type: 'string',
            title: 'Parents'
        }
    },
    lastModifyingUser: {
        type: 'object',
        title: 'Last Modifying User',
        properties: {
            displayName: { type: 'string', title: 'Last Modifying User.Display Name' },
            kind: { type: 'string', title: 'Last Modifying User.Kind' },
            me: { type: 'boolean', title: 'Last Modifying User.Me' },
            permissionId: { type: 'string', title: 'Last Modifying User.Permission Id' },
            emailAddress: { type: 'string', title: 'Last Modifying User.Email Address' },
            photoLink: { type: 'string', title: 'Last Modifying User.Photo Link' }
        }
    },
    owners: {
        type: 'array',
        title: 'Owners',
        items: {
            type: 'object',
            properties: {
                displayName: { type: 'string', title: 'Owners.Display Name' },
                kind: { type: 'string', title: 'Owners.Kind' },
                me: { type: 'boolean', title: 'Owners.Me' },
                permissionId: { type: 'string', title: 'Owners.Permission Id' },
                emailAddress: { type: 'string', title: 'Owners.Email Address' },
                photoLink: { type: 'string', title: 'Owners.Photo Link' }
            }
        }
    },
    permissions: {
        type: 'array',
        title: 'Permissions',
        items: {
            type: 'object',
            properties: {
                kind: { type: 'string', title: 'Permissions.Kind' },
                id: { type: 'string', title: 'Permissions.Id' },
                type: { type: 'string', title: 'Permissions.Type' },
                domain: { type: 'string', title: 'Permissions.Domain' },
                role: { type: 'string', title: 'Permissions.Role' },
                allowFileDiscovery: { type: 'boolean', title: 'Permissions.Allow File Discovery' },
                displayName: { type: 'string', title: 'Permissions.Display Name' },
                emailAddress: { type: 'string', title: 'Permissions.Email Address' },
                photoLink: { type: 'string', title: 'Permissions.Photo Link' },
                deleted: { type: 'boolean', title: 'Permissions.Deleted' },
                pendingOwner: { type: 'boolean', title: 'Permissions.Pending Owner' }
            }
        }
    },
    spaces: {
        type: 'array',
        title: 'Spaces',
        items: {
            type: 'string',
            title: 'Spaces'
        }
    },
    capabilities: {
        type: 'object',
        title: 'Capabilities',
        properties: {
            canAcceptOwnership: { type: 'boolean', title: 'Capabilities.Can Accept Ownership' },
            canAddChildren: { type: 'boolean', title: 'Capabilities.Can Add Children' },
            canAddMyDriveParent: { type: 'boolean', title: 'Capabilities.Can Add My Drive Parent' },
            canChangeCopyRequiresWriterPermission: { type: 'boolean', title: 'Capabilities.Can Change Copy Requires Writer Permission' },
            canChangeSecurityUpdateEnabled: { type: 'boolean', title: 'Capabilities.Can Change Security Update Enabled' },
            canChangeViewersCanCopyContent: { type: 'boolean', title: 'Capabilities.Can Change Viewers Can Copy Content' },
            canComment: { type: 'boolean', title: 'Capabilities.Can Comment' },
            canCopy: { type: 'boolean', title: 'Capabilities.Can Copy' },
            canDelete: { type: 'boolean', title: 'Capabilities.Can Delete' },
            canDisableInheritedPermissions: { type: 'boolean', title: 'Capabilities.Can Disable Inherited Permissions' },
            canDownload: { type: 'boolean', title: 'Capabilities.Can Download' },
            canEdit: { type: 'boolean', title: 'Capabilities.Can Edit' },
            canEnableInheritedPermissions: { type: 'boolean', title: 'Capabilities.Can Enable Inherited Permissions' },
            canListChildren: { type: 'boolean', title: 'Capabilities.Can List Children' },
            canModifyContent: { type: 'boolean', title: 'Capabilities.Can Modify Content' },
            canModifyContentRestriction: { type: 'boolean', title: 'Capabilities.Can Modify Content Restriction' },
            canModifyEditorContentRestriction: { type: 'boolean', title: 'Capabilities.Can Modify Editor Content Restriction' },
            canModifyOwnerContentRestriction: { type: 'boolean', title: 'Capabilities.Can Modify Owner Content Restriction' },
            canModifyLabels: { type: 'boolean', title: 'Capabilities.Can Modify Labels' },
            canMoveChildrenWithinDrive: { type: 'boolean', title: 'Capabilities.Can Move Children Within Drive' },
            canMoveItemIntoTeamDrive: { type: 'boolean', title: 'Capabilities.Can Move Item Into Team Drive' },
            canMoveItemOutOfDrive: { type: 'boolean', title: 'Capabilities.Can Move Item Out Of Drive' },
            canMoveItemWithinDrive: { type: 'boolean', title: 'Capabilities.Can Move Item Within Drive' },
            canReadLabels: { type: 'boolean', title: 'Capabilities.Can Read Labels' },
            canReadRevisions: { type: 'boolean', title: 'Capabilities.Can Read Revisions' },
            canRemoveChildren: { type: 'boolean', title: 'Capabilities.Can Remove Children' },
            canRemoveContentRestriction: { type: 'boolean', title: 'Capabilities.Can Remove Content Restriction' },
            canRemoveMyDriveParent: { type: 'boolean', title: 'Capabilities.Can Remove My Drive Parent' },
            canRename: { type: 'boolean', title: 'Capabilities.Can Rename' },
            canShare: { type: 'boolean', title: 'Capabilities.Can Share' },
            canTrash: { type: 'boolean', title: 'Capabilities.Can Trash' },
            canUntrash: { type: 'boolean', title: 'Capabilities.Can Untrash' }
        }
    },
    permissionIds: {
        type: 'array',
        title: 'Permission Ids',
        items: {
            type: 'string',
            title: 'Permission Ids'
        }
    },
    linkShareMetadata: {
        type: 'object',
        title: 'Link Share Metadata',
        properties: {
            securityUpdateEligible: { type: 'boolean', title: 'Link Share Metadata.Security Update Eligible' },
            securityUpdateEnabled: { type: 'boolean', title: 'Link Share Metadata.Security Update Enabled' }
        }
    },
    kind: { type: 'string', title: 'Kind' },
    id: { type: 'string', title: 'File ID' },
    name: { type: 'string', title: 'Name' },
    mimeType: { type: 'string', title: 'MIME Type' },
    starred: { type: 'boolean', title: 'Starred' },
    trashed: { type: 'boolean', title: 'Trashed' },
    explicitlyTrashed: { type: 'boolean', title: 'Explicitly Trashed' },
    version: { type: 'string', title: 'Version' },
    webViewLink: { type: 'string', title: 'Web View Link' },
    iconLink: { type: 'string', title: 'Icon Link' },
    hasThumbnail: { type: 'boolean', title: 'Has Thumbnail' },
    thumbnailLink: { type: 'string', title: 'Thumbnail Link' },
    thumbnailVersion: { type: 'string', title: 'Thumbnail Version' },
    viewedByMe: { type: 'boolean', title: 'Viewed By Me' },
    viewedByMeTime: { type: 'string', title: 'Viewed By Me Time' },
    createdTime: { type: 'string', title: 'Created Time' },
    modifiedTime: { type: 'string', title: 'Modified Time' },
    modifiedByMeTime: { type: 'string', title: 'Modified By Me Time' },
    modifiedByMe: { type: 'boolean', title: 'Modified By Me' },
    shared: { type: 'boolean', title: 'Shared' },
    ownedByMe: { type: 'boolean', title: 'Owned By Me' },
    viewersCanCopyContent: { type: 'boolean', title: 'Viewers Can Copy Content' },
    copyRequiresWriterPermission: { type: 'boolean', title: 'Copy Requires Writer Permission' },
    writersCanShare: { type: 'boolean', title: 'Writers Can Share' },
    size: { type: 'string', title: 'Size' },
    quotaBytesUsed: { type: 'string', title: 'Quota Bytes Used' },
    isAppAuthorized: { type: 'boolean', title: 'Is App Authorized' },
    inheritedPermissionsDisabled: { type: 'boolean', title: 'Inherited Permissions Disabled' }
};

'use strict';

module.exports = {

    async receive(context) {

        const { folderId, access, password, unsharedAt, canDownload, canPreview } = context.messages.in.content;

        if (!folderId) {
            throw new context.CancelError('Folder ID is required.');
        }

        // Build the shared_link object
        const sharedLink = {};

        if (access) {
            sharedLink.access = access;
        }

        if (password) {
            sharedLink.password = password;
        }

        if (unsharedAt) {
            sharedLink.unshared_at = unsharedAt;
        }

        // Build permissions object if any permission is specified
        if (canDownload !== undefined || canPreview !== undefined) {
            sharedLink.permissions = {};
            if (canDownload !== undefined) {
                sharedLink.permissions.can_download = canDownload;
            }
            if (canPreview !== undefined) {
                sharedLink.permissions.can_preview = canPreview;
            }
        }

        // https://developer.box.com/guides/shared-links/create/
        const { data } = await context.httpRequest({
            method: 'PUT',
            url: `https://api.box.com/2.0/folders/${folderId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json'
            },
            data: {
                shared_link: sharedLink
            }
        });

        return context.sendJson(data, 'out');
    }
};

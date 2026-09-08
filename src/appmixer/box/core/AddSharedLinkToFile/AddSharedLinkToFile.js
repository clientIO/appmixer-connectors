'use strict';

module.exports = {

    async receive(context) {

        const {
            fileId,
            access,
            password,
            unsharedAt,
            canDownload,
            canPreview
        } = context.messages.in.content;

        if (!fileId) {
            throw new context.CancelError('File ID is required!');
        }

        // Build the shared link object
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

        // https://developer.box.com/reference/put-files-id--add-shared-link/
        const { data } = await context.httpRequest({
            method: 'PUT',
            url: `https://api.box.com/2.0/files/${fileId}`,
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

'use strict';

const Dropbox = require('dropbox').Dropbox;

const pager = async (accessToken, hasMore = false, cursor, context) => {
    const dbx = new Dropbox({ accessToken });

    let currentPage;
    try {
        if (hasMore && cursor) {
            currentPage = await dbx.filesListFolderContinue({ cursor });
        } else {
            currentPage = await dbx.filesListFolder({
                path: context.messages.in.content.path || '',
                recursive: context.messages.in.content.recursive || false
            });
        }

        // Base case: Stop recursion when there are no more pages
        if (!currentPage.result.has_more) {
            return currentPage.result.entries;
        }

        // Recursive call only if there are more pages
        const nextPage = await pager(
            accessToken,
            currentPage.result.has_more,
            currentPage.result.cursor,
            context
        );

        return currentPage.result.entries.concat(nextPage);
    } catch (error) {
        throw new context.CancelError('Failed to list files');
    }
};

module.exports = {
    /**
     * Request for dropbox.
     * @param {Object} context
     * @param {string} authtoken
     * @param {string} endpoint
     * @param {string} action
     * @param {string} params
     * @returns {*}
     */
    dropboxRequest(context, authtoken, endpoint, action, params) {
        const options = {
            method: 'POST',
            url: `https://api.dropboxapi.com/2/${endpoint}/${action}`,
            headers: {
                Authorization: `Bearer ${authtoken}`,
                'Content-Type': 'application/json'
            },
            data: params
        };

        return context.httpRequest(options);
    },

    /**
     * Upload request for dropbox.
     * @param {Object} context
     * @param {string} authtoken
     * @param {string} endpoint
     * @param {string} action
     * @param {string} params
     * @param {string} [data]
     * @returns {*}
     */
    uploadDropboxRequest(context, authtoken, endpoint, action, params, data) {
        const options = {
            method: 'POST',
            url: `https://content.dropboxapi.com/2/${endpoint}/${action}`,
            headers: {
                Authorization: `Bearer ${authtoken}`,
                'Content-Type': 'application/octet-stream',
                'Dropbox-API-Arg': params
            },
            data
        };

        return context.httpRequest(options);
    },

    pager
};

'use strict';
const Dropbox = require('dropbox').Dropbox;

const pager = async (accessToken, hasMore = false, cursor, context) => {

    const dbx = new Dropbox({ accessToken });
    let currentPage;
    if (hasMore) {
        currentPage = await dbx.filesListFolderContinue({ cursor });
    } else {
        currentPage = await dbx.filesListFolder({
            path: context.messages.in.content.path || '',
            recursive: context.messages.in.content.recursive || false
        });
    }

    const nextPage = await pager(
        accessToken,
        currentPage.result.has_more,
        currentPage.result.cursor,
        context
    );
    return currentPage.result.entries.concat(nextPage);
};

module.exports = {
    /**
     * Request for dropbox.
     * @param {string} authtoken
     * @param {string} endpoint
     * @param {string} action
     * @param {string} params
     * @returns {*}
     */
    dropboxRequest(context, authtoken, endpoint, action, params) {

        let options = {
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
     * @param {string} authtoken
     * @param {string} endpoint
     * @param {string} action
     * @param {string} params
     * @param {string} [data]
     * @returns {*}
     */
    uploadDropboxRequest(context, authtoken, endpoint, action, params, data) {

        let options = {
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

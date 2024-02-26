'use strict';
const commons = require('../../dropbox-commons');
const Promise = require('bluebird');

/**
 * Process folders to find newly added.
 * @param {Set} knownFolders
 * @param {Array} currentFolders
 * @param {Array} newFolders
 * @param {Object} folder
 */
function processFolders(knownFolders, currentFolders, newFolders, folder) {

    if (
        knownFolders &&
    folder['.tag'] === 'folder' &&
    !knownFolders.has(folder['id'])
    ) {
        newFolders.push(folder);
    }
    currentFolders.push(folder['id']);
}

/**
 * Component which triggers whenever new file is added
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let params = {
            path: '',
            recursive: true,
            include_media_info: true
        };

        let { data } = await commons.dropboxRequest(
            context,
            context.auth.accessToken,
            'files',
            'list_folder',
            JSON.stringify(params)
        );

        let known = Array.isArray(context.state.known)
            ? new Set(context.state.known)
            : null;
        let current = [];
        let diff = [];

        data['entries'].forEach(processFolders.bind(null, known, current, diff));

        await Promise.map(diff, (folder) => {
            return context.sendJson(folder, 'newFolder');
        });
        await context.saveState({ known: current });
    }
};

'use strict';
const commons = require('../../dropbox-commons');
const Promise = require('bluebird');

/**
 * Process files to find newly added.
 * @param {Set} knownFiles
 * @param {Array} currentFiles
 * @param {Array} newFiles
 * @param {Object} file
 */
function processFiles(knownFiles, currentFiles, newFiles, file) {
    if (knownFiles && file['.tag'] === 'file' && !knownFiles.has(file['id'])) {
        newFiles.push(file);
    }
    currentFiles.push(file['id']);
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

        data['entries'].forEach(processFiles.bind(null, known, current, diff));

        await Promise.map(diff, (file) => {
            return context.sendJson(file, 'newFile');
        });
        await context.saveState({ known: current });
    }
};

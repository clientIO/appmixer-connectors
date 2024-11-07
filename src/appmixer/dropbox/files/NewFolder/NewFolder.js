'use strict';
const commons = require('../../dropbox-commons');
const Promise = require('bluebird');

function processFolders(knownFolders, currentFolders, newFolders, folder) {

    if (knownFolders && folder['.tag'] === 'folder' && !knownFolders.has(folder['id'])) {
        newFolders.push(folder);
    }
    currentFolders.push(folder['id']);
}

async function sync(context) {

    let params = {
        path: context.properties.path || '',
        recursive: typeof context.properties.recursive === 'undefined' ? false : context.properties.recursive,
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

    data['entries'].forEach(folder => {
        processFolders(known, current, diff, folder);
    });

    await context.saveState({ known: current });

    return diff;
}

module.exports = {

    start(context) {

        return sync(context);
    },

    async tick(context) {

        const diff = await sync(context);
        await Promise.map(diff, (folder) => {
            return context.sendJson(folder, 'newFolder');
        });
    }
};

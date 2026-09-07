'use strict';
const commons = require('../../dropbox-commons');
const Promise = require('bluebird');

function processFolders(knownFolders, currentFolders, newFolders, folder) {

    if (knownFolders && folder['.tag'] === 'folder' && !knownFolders.has(folder['id'])) {
        newFolders.push(folder);
    }
    currentFolders.push(folder['id']);
}

// Shared by sync() (production) and test() (Flow Test Mode): the list_folder request.
async function listEntries(context) {

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

    return data['entries'];
}

async function sync(context) {

    const entries = await listEntries(context);

    let known = Array.isArray(context.state.known)
        ? new Set(context.state.known)
        : null;
    let current = [];
    let diff = [];

    entries.forEach(folder => {
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
    },

    // Flow Test Mode: emit one representative folder using the SAME request path as tick(),
    // but WITHOUT the start()/state baseline that suppresses first-run output.
    async test(context) {

        const entries = await listEntries(context);
        const folders = entries.filter(entry => entry['.tag'] === 'folder');
        if (!folders.length) {
            throw new Error('No folders found to use as test data.');
        }

        // Folder entries carry no timestamp; list_folder returns the most recently added
        // entries last, so take the last folder as the most representative "new" one.
        return context.sendJson(folders[folders.length - 1], 'newFolder');
    }
};

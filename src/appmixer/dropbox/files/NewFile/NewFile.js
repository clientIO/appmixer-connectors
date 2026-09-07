'use strict';
const commons = require('../../dropbox-commons');
const Promise = require('bluebird');

function processFiles(knownFiles, currentFiles, newFiles, file) {
    if (knownFiles && file['.tag'] === 'file' && !knownFiles.has(file['id'])) {
        newFiles.push(file);
    }
    currentFiles.push(file['id']);
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

    entries.forEach(file => {
        processFiles(known, current, diff, file);
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
        await Promise.map(diff, (file) => {
            return context.sendJson(file, 'newFile');
        });
    },

    // Flow Test Mode: emit one representative file using the SAME request path as tick(),
    // but WITHOUT the start()/state baseline that suppresses first-run output.
    async test(context) {

        const entries = await listEntries(context);
        const files = entries.filter(entry => entry['.tag'] === 'file');
        if (!files.length) {
            throw new Error('No files found to use as test data.');
        }

        // Newest first by server_modified, matching the shape tick() emits.
        files.sort((a, b) => {
            return new Date(b['server_modified'] || 0) - new Date(a['server_modified'] || 0);
        });

        return context.sendJson(files[0], 'newFile');
    }
};

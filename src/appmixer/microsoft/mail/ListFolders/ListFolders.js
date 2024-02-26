'use strict';

const { makeRequest } = require('../commons');

module.exports = {

    async receive(context) {

        const { data } = await makeRequest(context, {
            path: '/me/mailFolders',
            method: 'GET'
        });
        return context.sendJson({ folders: data.value }, 'out');
    },
    foldersToSelectArray({ folders }) {

        return folders.map(folder => {
            return { label: folder.displayName, value: folder.id };
        });
    }
};


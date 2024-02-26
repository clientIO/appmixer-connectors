'use strict';
const commons = require('../../dropbox-commons');
const Promise = require('bluebird');

function buildFolders(data) {
    return data.matches.filter((entry) => entry['metadata']['.tag'] === 'folder');
}

/**
 * Component for find folder.
 * @extends {Component}
 */
module.exports = {
    receive(context) {
        let params = {
            path: '',
            query: context.messages.query.content.name,
            start: 0,
            max_results: context.messages.query.content.maxResults,
            mode: context.messages.query.content.mode
        };

        return commons
            .dropboxRequest(
                context,
                context.auth.accessToken,
                'files',
                'search',
                JSON.stringify(params)
            )
            .then(({ data }) => {
                return Promise.map(buildFolders(data), (folder) => {
                    return context.sendJson(folder['metadata'], 'folder');
                });
            });
    }
};

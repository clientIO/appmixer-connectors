'use strict';
const commons = require('../../dropbox-commons');
const Promise = require('bluebird');

/**
 * Component for find file.
 * @extends {Component}
 */
function buildFiles(data) {

    return data.matches.filter((entry) => entry['metadata']['.tag'] === 'file');
}

module.exports = {

    receive(context) {

        let params = {
            path: context.messages.query.content.path || '',
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
                return Promise.map(buildFiles(data), (file) => {
                    return context.sendJson(file['metadata'], 'file');
                });
            });
    }
};

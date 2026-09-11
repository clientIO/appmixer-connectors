'use strict';
const commons = require('../../dropbox-commons');

/**
 * Component for create folder.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        if (!context.messages.folder.content.path) {
            throw new context.CancelError('Path is required!');
        }

        let params = {
            path: context.messages.folder.content.path,
            autorename: context.messages.folder.content.autorename
        };

        return commons
            .dropboxRequest(
                context,
                context.auth.accessToken,
                'files',
                'create_folder_v2',
                JSON.stringify(params)
            )
            .then(({ data }) => {
                return context.sendJson(data.metadata, 'newFolder');
            });
    }
};

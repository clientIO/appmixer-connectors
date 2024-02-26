'use strict';
const commons = require('../../dropbox-commons');

/**
 * Component for renaming a file.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { path, newName } = context.messages.file.content;
        const params = {
            from_path: path,
            to_path: `${path.substring(0, path.lastIndexOf('/') + 1)}${newName}`,
            allow_shared_folder: false,
            autorename: false,
            allow_ownership_transfer: false
        };

        return commons
            .dropboxRequest(
                context,
                context.auth.accessToken,
                'files',
                'move_v2',
                JSON.stringify(params)
            )
            .then(({ data }) => {
                return context.sendJson(data.metadata, 'out');
            });
    }
};

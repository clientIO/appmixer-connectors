'use strict';
const commons = require('../../dropbox-commons');

/**
 * Component for create text file.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        if (!context.messages.file.content.path) {
            throw new context.CancelError('Path is required!');
        }

        let params = {
            path: context.messages.file.content.path,
            autorename: context.messages.file.content.autorename,
            mode: 'add'
        };
        let data = context.messages.file.content.text;

        return commons
            .uploadDropboxRequest(
                context,
                context.auth.accessToken,
                'files',
                'upload',
                JSON.stringify(params),
                data
            )
            .then(({ data }) => {
                return context.sendJson(data, 'newTextFile');
            });
    }
};

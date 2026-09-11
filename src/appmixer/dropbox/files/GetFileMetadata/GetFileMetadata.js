'use strict';
const { Dropbox } = require('dropbox');

module.exports = {

    async receive(context) {

        const dbx = new Dropbox({ accessToken: context.auth.accessToken });
        if (!context.messages.in.content.path) {
            throw new context.CancelError('Path is required!');
        }

        const { result } = await dbx.filesGetMetadata({
            path: context.messages.in.content.path
        });
        return context.sendJson(result, 'out');
    }
};

'use strict';
const { Dropbox } = require('dropbox');

module.exports = {

    async receive(context) {

        const dbx = new Dropbox({ accessToken: context.auth.accessToken });
        const { result } = await dbx.filesGetMetadata({
            path: context.messages.in.content.path
        });
        return context.sendJson(result, 'out');
    }
};

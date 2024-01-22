'use strict';
const Hubspot = require('../../Hubspot');
const FormData = require('form-data');

module.exports = {

    async receive(context) {

        const { fileId, fileName } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        var filestream = await context.getFileReadStream(fileId);

        var options = {
            access: 'PUBLIC_NOT_INDEXABLE',
            overwrite: false,
            duplicateValidationStrategy: 'NONE',
            duplicateValidationScope: 'EXACT_FOLDER',
        };

        let form = new FormData();
        form.append('file', filestream, fileName);
        form.append('options', JSON.stringify(options));
        form.append('fileName', fileName);
        form.append('folderPath', '/');

        // Had to craft an http call instead of hs.call, due to the form data/headers
        try {
            const { data } = await context.httpRequest({
                url: 'https://api.hubapi.com/files/v3/files',
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + auth.accessToken
                },
                data: form
            });
            return context.sendJson(data, 'out');

        } catch (e) {
            if (e.response && e.response.data && e.response.data.message) {
                const error = new Error(e.response.data.message);
                error.status = e.response.status;
                error.data = e.response.data;
                throw error;
            }
            throw e;
        }
    }
};

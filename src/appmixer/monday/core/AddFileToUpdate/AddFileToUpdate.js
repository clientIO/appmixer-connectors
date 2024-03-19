const FormData = require('form-data');
const queries = require('../../queries');

/**
 * Component for making API requests.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { fileId, fileName, updateId } = context.messages.file.content;
        const query = queries.addFileToUpdate({ updateId });

        const filestream = await context.getFileReadStream(fileId);

        const form = new FormData();
        form.append('variables[file]', filestream, fileName);
        form.append('query', query);
        const { data } = await context.httpRequest({
            url: 'https://api.monday.com/v2/file',
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + context.auth.apiKey
            },
            data: form
        });
        return context.sendJson(data, 'out');
    }
};

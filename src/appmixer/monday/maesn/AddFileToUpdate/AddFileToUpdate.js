'use strict';
const FormData = require('form-data');

/**
 * Component for making API requests.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const {fileId, fileName, updateId} = context.messages.file.content;
        const query = "mutation add_file_to_update($file: File!) { add_file_to_update (update_id: " + updateId + ", file: $file) {id}}";

        var filestream = await context.getFileReadStream(fileId);

        let form = new FormData();
        form.append("variables[file]", filestream, fileName);
        form.append("query", query);
        const { data } = await context.httpRequest({
            url: 'https://api.monday.com/v2/file',
            method: "POST",
            headers: { 
                "Authorization": "Bearer " + context.auth.apiKey
            },
            data: form
        });
        return context.sendJson(data, 'out');
    }
};
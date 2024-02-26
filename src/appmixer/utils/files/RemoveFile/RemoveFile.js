'use strict';

module.exports = {

    async receive(context) {

        const { fileId } = context.messages.in.content;
        const deletedFile = await context.removeFile(fileId);
        return context.sendJson(deletedFile, 'deleted');
    }
};

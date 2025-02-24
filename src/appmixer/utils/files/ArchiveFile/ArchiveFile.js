'use strict';

module.exports = {

    async receive(context) {

        const { fileId } = context.messages.in.content;

        await context.archiveFile(fileId);

        return context.sendJson({
            fileId
        }, 'out');

    }
};

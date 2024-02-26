'use strict';
const mailchimpDriver = require('../../commons');
/**
 * Component deletes file.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { fileId } = context.messages.in.content;

        return mailchimpDriver.fileManager.deleteFile(context, {
            fileId
        }).then(() => {
            return context.sendJson({ id: fileId }, 'deletedFile');
        });
    }
};

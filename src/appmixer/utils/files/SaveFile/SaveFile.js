'use strict';

module.exports = {

    receive(context) {

        const { filename, mimetype, content, contentEncoding } = context.messages.in.content;
        return context.saveFile(
            filename,
            mimetype,
            Buffer.from(typeof content === 'string' ? content : JSON.stringify(content), contentEncoding)
        ).then(savedFile => {
            return context.sendJson(savedFile, 'file');
        });
    }
};

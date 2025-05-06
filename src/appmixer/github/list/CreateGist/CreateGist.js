'use strict';
const Promise = require('bluebird');
const lib = require('../../lib');

/**
 * Component for creating a new gist
 * @extends {Component}
 */
module.exports = {

    async receive(context) {
        let { description, isPublic, files } = context.messages.in.content;

        const processedFiles = await this.addFiles(context, files);

        const body = {
            description,
            public: isPublic,
            files: {}
        };

        processedFiles.forEach((file) => {
            body.files[file.filename] = { content: file.content };
        });

        const { data } = await lib.apiRequest(context, 'gists', {
            method: 'POST',
            body: body
        });

        return context.sendJson(data, 'out');
    },

    async addFiles(context, files) {

        const fileIds = (files.ADD || [])
            .map(file => file.fileId || null)
            .filter(fileId => fileId !== null);
        return await Promise.map(fileIds, async (fileId) => {
            const fileInfo = await context.getFileInfo(fileId);
            const fileStream = await context.getFileReadStream(fileId);
            const fileContent = fileStream.toString('base64');

            return { filename: fileInfo.filename, content: fileContent };
        });
    }
};

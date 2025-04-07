'use strict';

const { makeRequest } = require('../common');
const commons = require('../../microsoft-commons');

const MAX_SIZE = 10000;

module.exports = {

    async receive(context) {

        const { driveId, q, parentPath, fileTypesRestriction, outputType } = context.messages.in.content;
        const path = parentPath ? `:/${parentPath}:` : '';

        let filesAndFolder = [];
        let nextLink = `https://graph.microsoft.com/v1.0/drives/${driveId}/root${path}/search(q='${q}')?$top=${MAX_SIZE}`;

        do {
            const response = await makeRequest(
                {
                    url: nextLink,
                    method: 'GET',
                    body: null
                },
                context
            );

            nextLink = response['@data.nextLink'];
            filesAndFolder = filesAndFolder.concat(response.value);

        } while (nextLink);

        if (filesAndFolder.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        if (fileTypesRestriction?.length > 0) {
            const allowedFilesOrFolders = [];
            fileTypesRestriction.forEach((typeRestriction) => {
                filesAndFolder.forEach((fileOrFolder) => {
                    if (typeRestriction === 'folders') {
                        const isFolder = Object.keys(fileOrFolder).includes('folder');
                        if (isFolder) {
                            allowedFilesOrFolders.push(fileOrFolder);
                            return;
                        }
                    }
                    const isFile = Object.keys(fileOrFolder).includes('file');
                    if (typeRestriction === 'files') {
                        if (isFile) {
                            allowedFilesOrFolders.push(fileOrFolder);
                            return;
                        }
                    }
                    if (isFile && fileOrFolder.file.mimeType.startsWith(typeRestriction)) {
                        allowedFilesOrFolders.push(fileOrFolder);
                    }
                });
            });
            if (allowedFilesOrFolders.length === 0) {
                return context.sendJson({}, 'notFound');
            }
            context.log({ step: 'sendingAllowedFiles', allowedFiles: allowedFilesOrFolders });
            return await commons.sendArrayOutput({
                context,
                outputType,
                records: allowedFilesOrFolders
            });
        } else {
            return await commons.sendArrayOutput({
                context,
                outputType,
                records: filesAndFolder
            });
        }

    }
};

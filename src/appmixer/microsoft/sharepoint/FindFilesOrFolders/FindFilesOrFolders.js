'use strict';

const { makeRequest } = require('../common');
const commons = require('../../microsoft-commons');

const MAX_SIZE = 10000;

module.exports = {

    async receive(context) {
        context.log({ step: 'AUTH', auth: context.auth });
        const { driveId, parentPath, fileTypesRestriction, outputType } = context.messages.in.content;
        let { q } = context.messages.in.content;
        const path = parentPath ? `:/${parentPath}:` : '';

        if (!q) q = '';
        console.log('query: ', q);

        let filesAndFolder = [];
        let nextLink = `https://graph.microsoft.com/v1.0/drives/${driveId}/root${path}/search(q='${q}')?$top=${MAX_SIZE}`;

        context.log({ step: 'urlCalled', nextLink });

        const { value } = await makeRequest(
            {
                url: nextLink,
                method: 'GET',
                body: null
            },
            context
        );

        context.log({ step: 'response', value });

        filesAndFolder = value;

        if (filesAndFolder.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        //console.log('filesAndFolder result: ', filesAndFolder);

        if (fileTypesRestriction?.length > 0) {
            const allowedFilesOrFolders = [];
            fileTypesRestriction.forEach((typeRestriction) => {
                filesAndFolder.forEach((fileOrFolder) => {
                    const isFile = Object.keys(fileOrFolder).includes('file');
                    if (isFile && fileOrFolder.file.mimeType.startsWith(typeRestriction)) {
                        allowedFilesOrFolders.push(fileOrFolder);
                    }
                });
            });
            if (allowedFilesOrFolders.length === 0) {
                return context.sendJson({}, 'notFound');
            }

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

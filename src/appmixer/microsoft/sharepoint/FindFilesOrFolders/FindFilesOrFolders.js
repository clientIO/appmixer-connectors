'use strict';

const { makeRequest } = require('../common');
const commons = require('../../microsoft-commons');

const MAX_SIZE = 10000;

module.exports = {

    async receive(context) {
        const { driveId, parentPath, fileTypesRestriction, outputType } = context.messages.in.content;
        let { q } = context.messages.in.content;

        if (!q) q = '';
        const encodedQuery = encodeURIComponent(q);

        let filesAndFolder = [];

        let url;

        // Different URL is only used, because using /root:/<parentPath>:/search is unreliable, for example, it doesn't return all images even when searched for them using the query
        if (parentPath) {
            url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${parentPath}:/delta?$top=${MAX_SIZE}`;
        } else {
            url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root/search(q='${encodedQuery}')?$top=${MAX_SIZE}`;
        }

        const { value } = await makeRequest(
            {
                url,
                method: 'GET',
                body: null
            },
            context
        );

        filesAndFolder = value;

        if (parentPath && q) {
            filesAndFolder = filesAndFolder.filter((f) => f.name.includes(encodedQuery));
        }

        if (filesAndFolder.length === 0) {
            return context.sendJson({}, 'notFound');
        }

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

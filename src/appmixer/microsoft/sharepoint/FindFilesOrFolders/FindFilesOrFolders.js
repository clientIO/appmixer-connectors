'use strict';

const { makeRequest } = require('../common');
const commons = require('../../microsoft-commons');

const MAX_SIZE = 10000;

module.exports = {

    async receive(context) {
        context.log({ step: 'AUTH', auth: context.auth });
        const { driveId, parentPath, fileTypesRestriction, outputType } = context.messages.in.content;
        let { q } = context.messages.in.content;

        if (!q) q = '';
        const encodedQuery = encodeURIComponent(q);

        let nextLink;

        // Different URL is only used, because using /root:/<parentPath>:/search is unreliable
        // For example, it doesn't return all images even when searched for them using the query
        if (parentPath) {
            nextLink = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${parentPath}:/delta?$top=${MAX_SIZE}`;
        } else {
            nextLink = `https://graph.microsoft.com/v1.0/drives/${driveId}/root/search(q='${encodedQuery}')?$top=${MAX_SIZE}`;
        }

        let filesAndFolder = [];
        do {
            const response = await makeRequest(
                {
                    url: nextLink,
                    method: 'GET',
                    body: null
                },
                context
            );
            console.log('response length: ', response.value.length);

            nextLink = response['@odata.nextLink'];
            console.log('NEXT_LINK: ', nextLink);
            filesAndFolder = filesAndFolder.concat(response.value);

        } while (nextLink);

        if (parentPath && q) {
            filesAndFolder = filesAndFolder.filter((f) => f.name.includes(q));
        }

        if (filesAndFolder.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        if (fileTypesRestriction?.length > 0) {
            const allowedFilesOrFolders = filesAndFolder.filter(file =>
                fileTypesRestriction.some(typeRestriction =>
                    file.file?.mimeType.startsWith(typeRestriction)
                )
            );
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

'use strict';
const oneDriveAPI = require('onedrive-api');
const querystring = require('querystring');

const commons = require('../../microsoft-commons');
const PAGE_SIZE = 10000; // Number of items to retrieve per page

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return getOutputPortOptions(context, context.messages.in.content.outputType);
        }

        const {
            outputType,
            recursive,
            fileTypesRestriction
        } = context.messages.in.content;

        const files = recursive ? await listFolderRecursive(context) : await listFolder(context);

        if (Array.isArray(files) && files.length > 0) {
            if (fileTypesRestriction?.length > 0) {
                const allowedFiles = files.filter(file =>
                    fileTypesRestriction.some(typeRestriction =>
                        file.file?.mimeType.startsWith(typeRestriction)
                    )
                );
                if (allowedFiles.length === 0) {
                    return context.sendJson({}, 'notFound');
                }
                return await commons.sendArrayOutput({
                    context,
                    outputType,
                    records: allowedFiles
                });
            } else {
                return await commons.sendArrayOutput({
                    context,
                    outputType,
                    records: files
                });
            }
        } else {
            return context.sendJson({}, 'notFound');
        }
    }
};

/**
 * calling the `delta` endpoint to get all the files in the folder
 * @param context
 * @returns {Promise<*[]>}
 */
const listFolderRecursive = async (context) => {

    let {
        driveId,
        parentId,
        parentPath,
        limit = 100,
        select
    } = context.messages.in.content;

    const endpoint = commons.getDeltaLink({ driveId, parentId, parentPath });

    if (select && !select.includes('file')) {
        // we need to get the file property to know if it's a folder or not
        select += ',file';
    }
    const params = { select, '$top': PAGE_SIZE };

    let url = `${endpoint}?${querystring.stringify(params)}`;
    let hasMore = true;
    let needMore = true;
    let failsafe = 0;
    let result = [];

    while (hasMore && needMore && failsafe < limit) {

        const page = await listFolderRecursiveAction(context, url);
        result = result.concat(page.value);
        hasMore = page['@odata.nextLink'];
        needMore = result.length < limit;
        failsafe += 1;
        url = page['@odata.nextLink'];
    }

    result = result.slice(0, limit); // strip items over the limit
    return result;
};

const listFolderRecursiveAction = async (context, url) => {

    return await commons.formatError(async () => {

        const { data } = await commons.msGraphRequest(context, {
            action: url
        });

        data.value = data.value.filter(item => item.file); // files only
        return data;
    });
};

const listFolder = async (context) => {

    const {
        driveId,
        parentId,
        parentPath,
        limit,
        select,
        orderby,
        filter
    } = context.messages.in.content;

    const { accessToken, profileInfo } = context.auth;

    const MAX_LIMIT = limit || 100;
    let files = [];
    let nextLink = null;
    let totalFiles = 0;
    const queryParameters = { select, orderby, filter, top: Math.min(PAGE_SIZE, MAX_LIMIT - totalFiles) };

    const query = Object.entries(queryParameters)
        .map(([key, value]) => value && `${key}=${value}`)
        .filter(Boolean)
        .join('&');
    do {
        const options = {
            accessToken,
            itemId: parentId,
            itemPath: parentPath,
            drive: 'drive',
            driveId,
            skipToken: nextLink ? nextLink.split('?skiptoken=')[1] : null,
            query: `?${query}`
        };

        const result = await commons.formatError(async () => {
            return oneDriveAPI.items.listChildren(options);
        }, `Failed to list files in the folder "${parentId || parentPath}" from your SharePoint account (${profileInfo.userPrincipalName}).`);

        files = files.concat(result.value);
        nextLink = result['@odata.nextLink'];
        totalFiles += result.value.length;
    } while (nextLink && totalFiles < MAX_LIMIT);

    return files;
};

const getOutputPortOptions = (context, outputType) => {

    if (outputType === 'object' || outputType === 'first') {
        return context.sendJson(
            [
                { label: 'Current Item Index', value: 'index', schema: { type: 'integer' } },
                { label: 'Items Count', value: 'count', schema: { type: 'integer' } },
                { label: 'Item ID', value: 'id' },
                { label: 'Item Name', value: 'name' },
                { label: 'Created Date Time', value: 'createdDateTime' },
                { label: 'C Tag', value: 'cTag' },
                { label: 'E Tag', value: 'eTag' },
                { label: 'Last Modified Date Time', value: 'lastModifiedDateTime' },
                { label: 'Size', value: 'size' },
                { label: 'Web URL', value: 'webUrl' },
                { label: 'Created By User ID', value: 'createdBy.user.id' },
                { label: 'Created By User Display Name', value: 'createdBy.user.displayName' },
                { label: 'Last Modified By ID', value: 'lastModifiedBy.user.id' },
                {
                    label: 'Last Modified By Display Name',
                    value: 'lastModifiedBy.user.displayName'
                },
                { label: 'Parent Reference Drive ID', value: 'parentReference.driveId' },
                { label: 'Parent Reference Drive Type', value: 'parentReference.driveType' },
                { label: 'Parent Reference Drive Path', value: 'parentReference.path' }
            ],
            'out'
        );
    } else if (outputType === 'array') {
        return context.sendJson(
            [
                { label: 'Items Count', value: 'count', schema: { type: 'integer' } },
                {
                    label: 'Items',
                    value: 'result',
                    schema: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'string', title: 'Item ID' },
                                name: { type: 'string', title: 'Item Name' },
                                createdDateTime: { type: 'string', title: 'Created Date Time' },
                                cTag: { type: 'string', title: 'C Tag' },
                                eTag: { type: 'string', title: 'E Tag' },
                                lastModifiedDateTime: {
                                    type: 'string',
                                    title: 'Last Modified Date Time'
                                },
                                size: { type: 'string', title: 'Size' },
                                webUrl: { type: 'string', title: 'Web Url' },
                                createdByUserId: {
                                    type: 'string',
                                    title: 'Created By User Id'
                                },
                                createdByUserDisplayName: {
                                    type: 'string',
                                    title: 'Created By User Display Name'
                                },
                                lastModifiedByUserId: {
                                    type: 'string',
                                    title: 'Last Modified By User Id'
                                },
                                lastModifiedByUserDisplayName: {
                                    type: 'string',
                                    title: 'Last Modified By User Display Name'
                                },
                                parentReferenceDriveId: {
                                    type: 'string',
                                    title: 'Parent Reference Drive Id'
                                },
                                parentReferenceDriveType: {
                                    type: 'string',
                                    title: 'Parent Reference Drive Type'
                                },
                                parentReferencePath: {
                                    type: 'string',
                                    title: 'Parent Reference Path'
                                }
                            }
                        }
                    }
                }
            ],
            'out'
        );
    } else {
        // outputType === 'file'
        return context.sendJson([{ label: 'File ID', value: 'fileId' }, { label: 'Items Count', value: 'count', schema: { type: 'integer' } }], 'out');
    }
};

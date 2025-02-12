const { google } = require('googleapis');
const moment = require('moment');
const uuid = require('uuid');

let defaultExportFormats = {
    'application/vnd.google-apps.site': {
        extension: 'zip',
        mimeType: 'application/zip'
    },
    'application/vnd.google-apps.document': {
        extension: 'docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    },
    'application/vnd.google-apps.spreadsheet': {
        extension: 'xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    },
    'application/vnd.google-apps.presentation': {
        extension: 'pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    },
    'application/vnd.google-apps.drawing': {
        extension: 'png',
        mimeType: 'image/png'
    }
};

const processedItemsBuffer = function(data = []) {

    const MAX_GROUP_COUNT = 3;
    return {
        has(id) {
            return data.find(group => group.ids[id]);
        },
        add(group, id) {
            const groupData = data.find(groupData => groupData.group === group);
            if (!groupData) {
                const ids = {};
                ids[id] = true;
                data.push({ group, ids });
            } else {
                groupData.ids[id] = true;
            }
        },
        export() {
            return data.slice(-MAX_GROUP_COUNT);
        }
    };
};

const escapeSpecialCharacters = (string) => {

    if (!string) return string;

    const specialCharacters = ['\\', '"', "'", '\`'];
    // Escape special characters with backslash
    specialCharacters.forEach(char => {
        string = string.replace(new RegExp(`\\${char}`, 'g'), `\\${char}`);
    });

    return string;
};

const findSubfolders = async (context, drive, folderId) => {

    const query = `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder'`;
    let subfolders = [];
    const foundSubfolders = await findFiles(context, drive, query, 'folder', 'files(id)');
    for (const subfolder of foundSubfolders) {
        subfolders.push(subfolder);
        const nestedSubfolders = await findSubfolders(context, drive, subfolder.googleDriveFileMetadata.id);
        subfolders = subfolders.concat(nestedSubfolders);
    }
    return subfolders;
};

const prepareFileOutputItem = (item, index, items) => {
    return {
        index: index,
        count: items.length,
        isFolder: item.mimeType === 'application/vnd.google-apps.folder',
        isFile: item.mimeType !== 'application/vnd.google-apps.folder',
        googleDriveFileMetadata: item
    };
};

const findFiles = async (context, drive, query, orderBy = 'name asc', fields = '*') => {

    const pageSize = 1000;

    // First page.
    const { data } = await drive.files.list({ q: query, fields, pageSize, orderBy });
    let files = data.files || [];
    let nextPageToken = data.nextPageToken;

    // While there are more pages, keep fetching them.
    while (nextPageToken) {
        const nextPage = await drive.files.list({ q: query, pageToken: nextPageToken, pageSize, fields: '*', orderBy });
        files = files.concat(nextPage.data.files);
        nextPageToken = nextPage.data.nextPageToken;
    }

    const items = files.map(prepareFileOutputItem);
    return items;
};

const registerWebhook = async (context, { includeRemoved } = {}) => {

    let lock = null;
    try {
        lock = await context.lock(context.componentId);
        await unregisterWebhook(context);
    } catch (err) {
        if (!err.response || err.response.status !== 404) {
            lock && lock.unlock();
            throw err;
        }
    }

    try {
        const auth = getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        let pageToken = await context.stateGet('startPageToken');

        if (!pageToken) {
            // when triggered for the first time, we have to get the startPageToken
            const { data: token } = await drive.changes.getStartPageToken();
            pageToken = token.startPageToken;
        }

        const channelId = uuid.v4();

        const expiration = moment().add(1, 'day').valueOf();
        const { data } = await drive.changes.watch({
            includeRemoved: includeRemoved || false,
            pageToken,
            requestBody: {
                address: context.getWebhookUrl() + '?enqueueOnly=true',
                id: channelId,
                payload: true,
                type: 'web_hook',
                expiration
            }
        });

        await context.stateSet('startPageToken', pageToken);
        await context.stateSet('channelId', channelId);
        await context.stateSet('webhookId', data.resourceId);
        await context.stateSet('expiration', expiration);
    } finally {
        lock && lock.unlock();
    }
};

const unregisterWebhook = async (context) => {

    const { webhookId, channelId } = await context.loadState();
    if (webhookId) {
        const auth = getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });

        return drive.channels.stop({
            requestBody: {
                resourceId: webhookId,
                id: channelId
            }
        });
    }
};

const arraysOverlap = (array1, array2) => {
    if (!array1 || !array2) return false;
    // Use the `some` method to check if any element in array1 exists in array2.
    return array1.some(item => array2.includes(item));
};

const isSubfolderStructureChanged = (change, folderIds) => {

    const file = change.file;
    if (!file) return false;
    if (file.mimeType !== 'application/vnd.google-apps.folder') return;
    const isSubfolder = arraysOverlap(file.parents.concat(file.id), folderIds);
    const isKnown = folderIds.includes(file.id);

    if (isSubfolder && change.removed) {
        // Subfolder deleted.
        return true;
    } else if (isSubfolder && file.trashed) {
        // Subfolder trashed.
        return true;
    } else if (isSubfolder && !isKnown) {
        // Subfolder is new.
        return true;
    } else if (!isSubfolder && isKnown) {
        // Subfolder moved.
        return true;
    }
    return false;
};

const getChangedFiles = async (
    context,
    lock,
    drive,
    filter,
    folderIds,
    fileTypesRestriction,
    includeRemoved,
    pageToken, files = []) => {

    const { data: { changes, newStartPageToken, nextPageToken } } = await drive.changes.list({
        pageToken,
        fields: '*',
        includeRemoved: includeRemoved || false
    });

    let subfolderStructureChanged = false;

    if (isDebug(context)) {
        await context.log({ step: 'changes-detected', changes });
    }

    changes.forEach(change => {

        const mimeType = change.file?.mimeType;

        if (folderIds.length && isSubfolderStructureChanged(change, folderIds)) {
            // We only check for subfolder structure changes when folder is set.
            subfolderStructureChanged = true;
        }

        if (filter(change)) {
            if (files.find(file => file.id === change.file.id)) {
                // We've already processed this file (sometimes the same file change may occur multiple times in the change list).
                return;
            }

            // Check for location folder match.
            // For recursive folder matching, we need to check the parent folders of the file.
            // Unfortunately, google drive API does not return a list of all ancestors, only the immediate parent.
            // Getting all ancestors here by invoking the API for each immediate parent would be too slow and
            // consume too many requests.
            // Therefore, we reqeuest all subfolder IDs at start (if folder is set) and then check if the file is in any of them here.
            // Then, we also need to reconstruct our cached subfolder list when new folder has been added, deleted or moved.
            if (folderIds.length && !arraysOverlap(change.file?.parents, folderIds)) {
                return;
            }

            // Check for file type restrictions.
            if (fileTypesRestriction && fileTypesRestriction.length) {
                let isAllowed = false;
                for (let i = 0; i < fileTypesRestriction.length; i++) {
                    const allowedType = fileTypesRestriction[i];
                    isAllowed = allowedType === '#FILE' ? false : mimeType.startsWith(allowedType);
                    if (isAllowed) break; // No need to search further since we found a match.
                }
                if (!isAllowed) return;
            }

            files.push(change.file);
        }
    });

    if (nextPageToken) {
        await lock.extend(20000);
        return getChangedFiles(
            context,
            lock,
            drive,
            filter,
            folderIds,
            fileTypesRestriction,
            includeRemoved,
            nextPageToken,
            files);
    }

    return { files, newStartPageToken, subfolderStructureChanged };
};

const checkMonitoredFiles = async function(context, { filter, includeRemoved } = {}) {

    const { folder = {}, recursive = false, fileTypesRestriction } = context.properties;

    let folderIds = [];
    if (typeof folder === 'string') {
        folderIds.push(folder);
    } else if (folder.id) {
        folderIds.push(folder.id);
    }

    let lock = null;
    try {
        lock = await context.lock(context.componentId, { maxRetryCount: 0 });
    } catch (err) {
        await context.stateSet('hasSkippedMessage', true);
        return;
    }

    try {
        const { startPageToken, processedFiles = [] } = await context.loadState();
        const auth = getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });

        if (folderIds.length && recursive) {
            // Check if we have stored all the subfolder IDs.
            // Recursive option only applies when folder is set.
            const cachedFolderIds = await context.stateGet('cachedFolderIds');
            if (cachedFolderIds) {
                folderIds = cachedFolderIds;
            } else {
                for (let folderId of folderIds) {
                    const subfolders = await findSubfolders(context, drive, folderId);
                    for (let subfolder of subfolders) {
                        folderIds.push(subfolder.googleDriveFileMetadata.id);
                    }
                }
                await context.log({ step: 'subfolders-cached', count: folderIds.length, folderIds });
                await context.stateSet('cachedFolderIds', folderIds);
            }
        }

        await context.stateSet('hasSkippedMessage', false);

        const {
            files,
            newStartPageToken,
            subfolderStructureChanged
        } = await getChangedFiles(
            context,
            lock,
            drive,
            filter,
            folderIds,
            fileTypesRestriction,
            includeRemoved,
            startPageToken);

        if (subfolderStructureChanged) {
            await context.stateUnset('cachedFolderIds');
        }

        const processedFilesSet = processedItemsBuffer(processedFiles);

        for (let file of files) {
            if (!processedFilesSet.has(file.id)) {
                processedFilesSet.add(newStartPageToken, file.id);
                const out = {
                    isFolder: file.mimeType === 'application/vnd.google-apps.folder',
                    isFile: file.mimeType !== 'application/vnd.google-apps.folder',
                    googleDriveFileMetadata: file
                };
                await context.sendJson(out, 'out');
                await context.stateSet('processedFiles', processedFilesSet.export());
            }
        }

        await context.stateSet('startPageToken', newStartPageToken);

    } finally {
        if (lock) {
            await lock.unlock();
        }
    }
};

const getOauth2Client = (auth) => {

    const { clientId, clientSecret, accessToken } = auth;
    let OAuth2 = google.auth.OAuth2;
    let oauth2Client = new OAuth2({
        clientId,
        clientSecret
    });

    oauth2Client.setCredentials({
        'access_token': accessToken
    });

    return oauth2Client;
};

const getCredentials = (credentials) => {
    return {
        accessToken: credentials.accessToken,
        expiryDate: credentials.expDate
    };
};

const isDebug = (context) => {
    return context.config.DEBUG === 'true' || false;
};

module.exports = {

    processedItemsBuffer,
    defaultExportFormats,
    escapeSpecialCharacters,
    findSubfolders,
    findFiles,
    registerWebhook,
    unregisterWebhook,
    checkMonitoredFiles,
    getOauth2Client,
    getCredentials,
    isDebug
};

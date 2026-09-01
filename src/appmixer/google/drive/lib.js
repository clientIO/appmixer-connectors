const { google } = require('googleapis');
const moment = require('moment');
const uuid = require('uuid');

// Maximum number of `drive.changes.list` pages processed by a single receive()/tick()
// invocation. Without a cap, a large change backlog (stale startPageToken, rate limited
// account, Google 5xx retries) keeps the component lock held for hours, which starves
// tick()/start() with LockError storms and livelocks on message redelivery.
const MAX_PAGES_PER_RUN = 20;

// TTL the component lock is (re)armed with before every page and periodically while
// emitting. It has to comfortably cover one `changes.list` call including gaxios retries,
// otherwise the lock expires mid-run and registerWebhook() may clobber `startPageToken`.
const LOCK_TTL = 60 * 1000;

// Re-arm the lock every N emitted files so a large batch does not outlive the last extension.
const LOCK_EXTEND_EVERY_FILES = 20;

// Hard HTTP timeout for the Google Drive API so a hung call cannot outlive the lock.
const HTTP_TIMEOUT = 30 * 1000;

// Raised when the component lock could no longer be extended. Processing must stop rather
// than continue unprotected - progress is durable, so the next tick() resumes where we left off.
class LockLostError extends Error {}

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

// Re-arm the component lock. Throws LockLostError when the lock is already gone so that
// callers abort instead of silently carrying on without mutual exclusion.
const extendLock = async (lock) => {

    try {
        await lock.extend(LOCK_TTL);
    } catch (err) {
        throw new LockLostError(`Cannot extend the Google Drive component lock: ${err.message}`);
    }
};

// Release the lock without ever masking the error that is already propagating.
const safeUnlock = async (context, lock) => {

    if (!lock) return;
    try {
        await lock.unlock();
    } catch (err) {
        await context.log({ step: 'unlock-failed', error: err.message });
    }
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

const findSubfolders = async (context, drive, folderId, orderBy) => {

    const query = `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder'`;
    let subfolders = [];
    const foundSubfolders = await findFiles(context, drive, query, orderBy || 'folder', 'files(id)');
    for (const subfolder of foundSubfolders) {
        subfolders.push(subfolder);
        const nestedSubfolders = await findSubfolders(context, drive, subfolder.googleDriveFileMetadata.id, orderBy);
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

/**
 * (Re)registers the Drive changes watch channel.
 * @param {Object} context
 * @param {boolean} [options.includeRemoved]
 * @param {number} [options.maxRetryCount] How hard to try to acquire the component lock.
 *   Pass 0 from tick() so a renewal simply skips a contended lock and retries on the next
 *   tick instead of exhausting 31 attempts and throwing a LockError every single minute.
 *   start() keeps the default retries because it has no next attempt.
 * @return {Promise<void>}
 */
const registerWebhook = async (context, { includeRemoved, maxRetryCount } = {}) => {

    const lockOptions = {};
    if (typeof maxRetryCount === 'number') {
        lockOptions.maxRetryCount = maxRetryCount;
    }

    let lock = null;
    try {
        lock = await context.lock(context.componentId, lockOptions);
    } catch (err) {
        if (maxRetryCount === 0) {
            // Somebody else (typically a receive() working through a change backlog) holds
            // the lock. Skip this renewal, the next tick() will try again.
            await context.log({ step: 'webhook-renewal-skipped', reason: err.message });
            return;
        }
        throw err;
    }

    try {
        try {
            await unregisterWebhook(context);
        } catch (err) {
            if (!err.response || err.response.status !== 404) {
                throw err;
            }
        }

        const drive = getDriveClient(context.auth);
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
        await safeUnlock(context, lock);
    }
};

const unregisterWebhook = async (context) => {

    const { webhookId, channelId } = await context.loadState();
    if (webhookId) {
        const drive = getDriveClient(context.auth);

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
    // In some cases, `file.parents` may be undefined (e.g., with read-only access and/or shared drives).
    const isSubfolder = arraysOverlap((file.parents || []).concat(file.id), folderIds);
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

// Fetch and filter a SINGLE page of `drive.changes.list`. Paging is driven by the caller so
// that progress can be persisted after every page and the work done under the component lock
// stays bounded.
const getChangedFilesPage = async (
    context,
    drive,
    filter,
    folderIds,
    fileTypesRestriction,
    includeRemoved,
    pageToken) => {

    const { data: { changes = [], newStartPageToken, nextPageToken } } = await drive.changes.list({
        pageToken,
        fields: '*',
        includeRemoved: includeRemoved || false
    });

    const files = [];
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
            if (fileTypesRestriction?.length) {
                let isAllowed = false;
                for (const allowedType of fileTypesRestriction) {
                    isAllowed = allowedType === '#FILE' ? mimeType !== 'application/vnd.google-apps.folder' : mimeType.startsWith(allowedType);
                    if (isAllowed) break; // No need to search further since we found a match.
                }
                if (!isAllowed) return;
            }

            files.push(change.file);
        }
    });

    return { files, newStartPageToken, nextPageToken, subfolderStructureChanged };
};

const checkMonitoredFiles = async function(context, { filter, includeRemoved } = {}) {

    const { folder = {}, recursive = false, fileTypesRestriction } = context.properties;

    // Normalize fileTypesRestriction to ensure it's always an array
    const normalizedFileTypesRestriction = normalizeMultiselectInput(fileTypesRestriction);

    let folderIds = [];
    if (typeof folder === 'string') {
        folderIds.push(folder);
    } else if (folder.id) {
        folderIds.push(folder.id);
    }

    let lock = null;
    try {
        lock = await context.lock(context.componentId, { maxRetryCount: 0, ttl: LOCK_TTL });
    } catch (err) {
        await context.stateSet('hasSkippedMessage', true);
        return;
    }

    try {
        const { startPageToken, processedFiles = [] } = await context.loadState();
        const drive = getDriveClient(context.auth);

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

        const processedFilesSet = processedItemsBuffer(processedFiles);

        let pageToken = startPageToken;
        let pagesProcessed = 0;

        while (pageToken) {

            // Re-arm the lock before every page so that a slow (or gaxios-retried) API call
            // cannot let the lock expire underneath us.
            await extendLock(lock);

            const page = await getChangedFilesPage(
                context,
                drive,
                filter,
                folderIds,
                normalizedFileTypesRestriction,
                includeRemoved,
                pageToken);

            if (page.subfolderStructureChanged) {
                // Force the subfolder list to be rebuilt on the next run.
                await context.stateUnset('cachedFolderIds');
            }

            // The processed-files buffer is grouped by the token the page ended on.
            const group = page.newStartPageToken || page.nextPageToken;
            let emitted = 0;
            for (const file of page.files) {
                if (processedFilesSet.has(file.id)) continue;
                processedFilesSet.add(group, file.id);
                await context.sendJson(toFileOutput(file), 'out');
                await context.stateSet('processedFiles', processedFilesSet.export());
                emitted += 1;
                if (emitted % LOCK_EXTEND_EVERY_FILES === 0) {
                    // Emitting a large batch must not outlive the last extension either.
                    await extendLock(lock);
                }
            }

            // Persist progress after EVERY page. A redelivered webhook message then resumes
            // here instead of replaying the whole backlog from the original token, which is
            // what turned a slow run into a livelock.
            pageToken = page.nextPageToken;
            const resumeToken = pageToken || page.newStartPageToken;
            if (resumeToken) {
                await context.stateSet('startPageToken', resumeToken);
            }
            pagesProcessed += 1;

            if (pageToken && pagesProcessed >= MAX_PAGES_PER_RUN) {
                // Bounded work per invocation: release the lock and let tick() carry on,
                // instead of holding it for the (potentially unbounded) rest of the backlog.
                await context.log({ step: 'changes-backlog-deferred', pagesProcessed });
                await context.stateSet('hasSkippedMessage', true);
                break;
            }
        }

    } catch (err) {
        if (!(err instanceof LockLostError)) {
            throw err;
        }
        // Progress is durable, so simply stop here and let the next tick() pick it up.
        await context.log({ step: 'lock-lost', error: err.message });
        await context.stateSet('hasSkippedMessage', true);
    } finally {
        await safeUnlock(context, lock);
    }
};

// Build the file resource output object exactly as checkMonitoredFiles() emits it.
const toFileOutput = (file) => {
    return {
        isFolder: file.mimeType === 'application/vnd.google-apps.folder',
        isFile: file.mimeType !== 'application/vnd.google-apps.folder',
        googleDriveFileMetadata: file
    };
};

// Read-only fetch of a single example file for Flow Test Mode, shaped identically to what the
// webhook path (checkMonitoredFiles) emits: { isFolder, isFile, googleDriveFileMetadata }.
// Honors the same folder / fileTypesRestriction filters the trigger uses and the same
// drive.files.list seam findFiles() uses. `filter` is the trigger's own change-style predicate
// (isNewFileOrFolder / isUpdatedFileOrFolder) applied to a synthesized change so the emitted
// file matches whichever path production would emit. Touches no state, registers no webhook.
const fetchLatestExampleFile = async (context, { orderBy, filter } = {}) => {

    const { folder = {}, fileTypesRestriction } = context.properties;
    const normalizedFileTypesRestriction = normalizeMultiselectInput(fileTypesRestriction);

    let folderId = null;
    if (typeof folder === 'string') {
        folderId = folder;
    } else if (folder.id) {
        folderId = folder.id;
    }

    const drive = getDriveClient(context.auth);

    // Exclude trashed files — the New/Updated triggers only emit non-trashed files.
    const queryParts = ['trashed = false'];
    if (folderId) {
        queryParts.push(`'${folderId}' in parents`);
    }

    const { data } = await drive.files.list({
        q: queryParts.join(' and '),
        fields: '*',
        pageSize: 50,
        orderBy: orderBy || 'modifiedTime desc'
    });

    const files = data.files || [];

    for (const file of files) {
        // Apply the trigger's own predicate against a synthesized "file" change.
        if (filter && !filter({ changeType: 'file', removed: false, file })) {
            continue;
        }
        // Apply the same file type restriction logic checkMonitoredFiles uses.
        if (normalizedFileTypesRestriction.length) {
            const mimeType = file.mimeType;
            let isAllowed = false;
            for (const allowedType of normalizedFileTypesRestriction) {
                isAllowed = allowedType === '#FILE' ? mimeType !== 'application/vnd.google-apps.folder' : mimeType.startsWith(allowedType);
                if (isAllowed) break;
            }
            if (!isAllowed) continue;
        }
        return toFileOutput(file);
    }

    return null;
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

// Authenticated Drive client with a hard HTTP timeout so that a hung request cannot keep
// running (and holding the component lock) indefinitely.
const getDriveClient = (auth) => {

    return google.drive({ version: 'v3', auth: getOauth2Client(auth), timeout: HTTP_TIMEOUT });
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

/**
 * Normalizes multiselect input to ensure it's always an array.
 * @param {string|Array} input - The input value from a multiselect field
 * @returns {Array} An array of values
 */
const normalizeMultiselectInput = (input) => {
    if (!input) return [];
    if (Array.isArray(input)) return input;
    if (typeof input === 'string') {
        return input.split(',').map(item => item.trim()).filter(item => item);
    }
    throw new Error('Invalid input type for multiselect field. Expected string or array.');
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
    getDriveClient,
    getCredentials,
    isDebug,
    normalizeMultiselectInput,
    toFileOutput,
    fetchLatestExampleFile
};

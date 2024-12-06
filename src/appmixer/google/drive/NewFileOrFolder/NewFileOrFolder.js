const moment = require('moment');
const { google } = require('googleapis');
const lib = require('../lib');

const getNewFiles = async (lock, drive, folder, fileTypesRestriction, pageToken, newFiles = []) => {

    const { data: { changes, newStartPageToken, nextPageToken } } = await drive.changes.list({
        pageToken,
        fields: '*',
        includeRemoved: false
    });

    changes.forEach(change => {
        if (change.changeType === 'file' && !change.removed && !change.file?.trashed && new Date(change.file?.createdTime) >= new Date(change.file?.modifiedTime)) {

            if (newFiles.find(file => file.id === change.file.id)) {
                // We've already processed this file (sometimes the same file change may occur multiple times in the change list).
                return;
            }

            const mimeType = change.file?.mimeType;

            // Check for location folder match.
            if (folder && !change.file?.parents?.includes(folder)) {
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

            newFiles.push(change.file);
        }
    });

    if (nextPageToken) {
        await lock.extend(20000);
        return getNewFiles(lock, drive, folder, fileTypesRestriction, nextPageToken, newFiles);
    }

    return { newFiles, newStartPageToken };
};

const detectNewFiles = async function(context) {

    const { folder = {}, fileTypesRestriction } = context.properties;

    let lock = null;
    try {
        lock = await context.lock(context.componentId, { maxRetryCount: 0 });
    } catch (err) {
        await context.stateSet('hasSkippedMessage', true);
        return;
    }

    try {
        const { startPageToken, processedFiles = [] } = await context.loadState();
        const auth = lib.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });

        await context.stateSet('hasSkippedMessage', false);

        const {
            newFiles,
            newStartPageToken
        } = await getNewFiles(lock, drive, folder.id, fileTypesRestriction, startPageToken);

        const processedFilesSet = lib.processedItemsBuffer(processedFiles);

        for (let file of newFiles) {
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

module.exports = {

    async start(context) {

        return this.registerWebhook(context);
    },

    stop(context) {

        return this.unregisterWebhook(context);
    },

    async receive(context) {

        if (!context.messages.webhook) {
            return;
        }

        if (context.messages.webhook.content.headers['x-goog-resource-state'] === 'sync') {
            // sync messages can be ignored
            return context.response();
        }

        await detectNewFiles(context);

        return context.response();
    },

    async tick(context) {

        const { expiration, hasSkippedMessage } = await context.loadState();

        if (hasSkippedMessage) {
            // a message came when we were processing results,
            // we have to check for new files again
            await detectNewFiles(context);
        }

        if (expiration) {
            const renewDate = moment(expiration).subtract(5, 'hours');
            if (moment().isSameOrAfter(renewDate)) {
                return this.registerWebhook(context);
            }
        }
    },

    async registerWebhook(context) {

        let lock = null;
        try {
            lock = await context.lock(context.componentId);
            await this.unregisterWebhook(context);
        } catch (err) {
            if (!err.response || err.response.status !== 404) {
                lock && lock.unlock();
                throw err;
            }
        }

        try {
            const auth = lib.getOauth2Client(context.auth);
            const drive = google.drive({ version: 'v3', auth });
            let pageToken = await context.stateGet('startPageToken');

            if (!pageToken) {
                // when triggered for the first time, we have to get the startPageToken
                const { data: token } = await drive.changes.getStartPageToken();
                pageToken = token.startPageToken;
            }

            const expiration = moment().add(1, 'day').valueOf();
            const { data } = await drive.changes.watch({
                includeRemoved: false,
                pageToken,
                requestBody: {
                    address: context.getWebhookUrl() + '?enqueueOnly=true',
                    id: context.componentId,
                    payload: true,
                    token: context.componentId,
                    type: 'web_hook',
                    expiration
                }
            });

            await context.stateSet('startPageToken', pageToken);
            await context.stateSet('webhookId', data.resourceId);
            await context.stateSet('expiration', expiration);
        } finally {
            lock && lock.unlock();
        }
    },

    async unregisterWebhook(context) {

        const { webhookId } = await context.loadState();
        if (webhookId) {
            const auth = lib.getOauth2Client(context.auth);
            const drive = google.drive({ version: 'v3', auth });

            return drive.channels.stop({
                requestBody: {
                    resourceId: webhookId,
                    id: context.componentId
                }
            });
        }
    }
};

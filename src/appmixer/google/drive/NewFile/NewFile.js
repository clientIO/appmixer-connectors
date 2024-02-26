'use strict';
const Promise = require('bluebird');
const moment = require('moment');
const { google } = require('googleapis');
const commons = require('../drive-commons');
const { URL, URLSearchParams } = require('url');

const getNewFiles = async (lock, drive, folder, pageToken, newFiles = []) => {

    const { data: { changes, newStartPageToken, nextPageToken } } = await drive.changes.list({ pageToken, fields: '*', includeRemoved: false, includeDeleted: false });

    changes.forEach(change => {
        if (change.changeType === 'file' && !change.removed && !change.file?.trashed && new Date(change.file?.createdTime) >= new Date(change.file?.modifiedTime)) {
            if (!folder) {
                // we're not interested in the folder, take all new files
                // sometimes the same file change may occur multiple times in the change list
                !newFiles.find(file => file.id === change.file.id) && newFiles.push(change.file);
            } else if (change.file?.parents?.includes(folder)) {
                !newFiles.find(file => file.id === change.file.id) && newFiles.push(change.file);
            }
        }
    });

    if (nextPageToken) {
        await lock.extend(20000);
        return getNewFiles(lock, drive, folder, nextPageToken, newFiles);
    }

    return { newFiles, newStartPageToken };
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

        // there's a bug in the drive changes API. Looks like they have a replica there and when the
        // webhook arrives the change may not get to all the replicas yet, therefore the getChanges
        // api sometimes does not correctly return that change (it's not there yet), component can handle
        // this situation (line 86), but seems that delaying the webhook a bit helps.
        await new Promise(resolve => {
            setTimeout(() => {
                resolve();
            }, 1000)
        });

        const { folder = {} } = context.properties;

        let lock = null;
        try {
            try{
                lock = await context.lock(context.componentId, { retryDelay: 4000 });
            }catch(e) {
                return;
            }
            const { startPageToken, lastChangeFileIDs } = await context.loadState();
            const lastFiles = Array.isArray(lastChangeFileIDs) ? new Set(lastChangeFileIDs) : new Set();

            const changesResourceURL = new URL(context.messages.webhook.content['headers']['x-goog-resource-uri']);
            const params = new URLSearchParams(changesResourceURL.searchParams);

            const auth = commons.getOauth2Client(context.auth);
            const drive = google.drive({ version: 'v3', auth });

            if (params.get('pageToken') < startPageToken) {
                // if the Google Drive changes API worked properly, this section wouldn't be needed,
                // but a pageToken with the same ID may be sent many times (case when multiple files
                // are created at the same time) through the webhook and return different results
                // when getting the list of changes starting from the same pageToken. That seems to
                // be a bug, that should not happen.
                const { newFiles } = await getNewFiles(lock, drive, folder.id, params.get('pageToken'));

                await Promise.map(newFiles, file => {
                    if (!lastFiles.has(file.id)) {
                        lastFiles.add(file.id);
                        return context.sendJson(file, 'file');
                    }
                }, { concurrency: 5 });

                await context.stateSet('lastChangeFileIDs', Array.from(lastFiles));

                // we have already processed that change
                return context.response();
            }

            const { newFiles, newStartPageToken } = await getNewFiles(lock, drive, folder.id, startPageToken);

            const newFileIDs = [];
            await Promise.map(newFiles, file => {
                newFileIDs.push(file.id);
                return context.sendJson(file, 'file');
            }, { concurrency: 5 });

            await context.stateSet('startPageToken', newStartPageToken);
            await context.stateSet('lastChangeFileIDs', newFileIDs);
        } finally {
            if (lock) {
                await lock.unlock();
            }
        }
        
        return context.response();
    },

    async tick(context) {

        const { expiration } = await context.loadState();
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
            const auth = commons.getOauth2Client(context.auth);
            const drive = google.drive({ version: 'v3', auth });
            const { userId } = context.auth;
            let pageToken = await context.stateGet('startPageToken');

            if (!pageToken) {
                // when triggered for the first time, we have to get the startPageToken
                const { data: token } = await drive.changes.getStartPageToken();
                pageToken = token.startPageToken;
            }

            const expiration = moment().add(1, 'day').valueOf();
            const { data } = await drive.changes.watch({
                quotaUser: userId,
                includeRemoved: false,
                pageToken,
                requestBody: {
                    address: context.getWebhookUrl(),
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
            const auth = commons.getOauth2Client(context.auth);
            const drive = google.drive({ version: 'v3', auth });
            const { userId } = context.auth;

            return drive.channels.stop({
                quotaUser: userId,
                requestBody: {
                    resourceId: webhookId,
                    id: context.componentId
                }
            });
        }
    }
};

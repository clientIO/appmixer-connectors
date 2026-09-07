const lib = require('../lib');
const moment = require('moment');

function isUpdatedFileOrFolder(change) {

    const file = change.file;
    if (!file) return false;

    return change.changeType === 'file' &&
    !change.removed &&  // exclude removed files
    !file.trashed &&  // exclude trashed files
    new Date(file.modifiedTime) > new Date(file.createdTime);  // file modified after creation.
}

module.exports = {

    async start(context) {

        return lib.registerWebhook(context);
    },

    stop(context) {

        return lib.unregisterWebhook(context);
    },

    async receive(context) {

        if (!context.messages.webhook) {
            return;
        }

        if (context.messages.webhook.content.headers['x-goog-resource-state'] === 'sync') {
            // sync messages can be ignored
            return context.response();
        }

        await lib.checkMonitoredFiles(context, { filter: isUpdatedFileOrFolder });

        return context.response();
    },

    async tick(context) {

        const { expiration, hasSkippedMessage } = await context.loadState();

        if (hasSkippedMessage) {
            // A message came when we were processing results,
            // we have to check for changes again.
            await lib.checkMonitoredFiles(context, { filter: isUpdatedFileOrFolder });
        }

        if (expiration) {
            const renewDate = moment(expiration).subtract(5, 'hours');
            if (moment().isSameOrAfter(renewDate)) {
                return lib.registerWebhook(context);
            }
        }
    },

    // Flow Test Mode: emit one realistic updated file/folder without registering a webhook.
    // Read-only — lists files newest-first by modifiedTime via the shared helper, honoring the
    // same folder/fileTypesRestriction filters and the same isUpdatedFileOrFolder predicate
    // receive() applies, and emits the file in the identical output shape.
    async test(context) {

        const example = await lib.fetchLatestExampleFile(context, {
            orderBy: 'modifiedTime desc',
            filter: isUpdatedFileOrFolder
        });
        if (!example) {
            throw new Error('No matching files or folders to use as test data.');
        }
        return context.sendJson(example, 'out');
    }
};

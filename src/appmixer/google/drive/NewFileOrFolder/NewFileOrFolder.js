const lib = require('../lib');
const moment = require('moment');

function isNewFileOrFolder(change) {

    const file = change.file;
    if (!file) return false;

    return change.changeType === 'file' &&
    !change.removed &&  // exclude removed files
    !file.trashed &&  // exclude trashed files
    new Date(file.createdTime) >= new Date(file.modifiedTime) &&  // exclude updates to a file
    new Date(file.createdTime) >= new Date(file.viewedByMeTime);  // exclude visiting a folder/file.
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

        await lib.checkMonitoredFiles(context, { filter: isNewFileOrFolder });

        return context.response();
    },

    async tick(context) {

        const { expiration, hasSkippedMessage } = await context.loadState();

        if (hasSkippedMessage) {
            // A message came when we were processing results,
            // we have to check for changes again.
            await lib.checkMonitoredFiles(context, { filter: isNewFileOrFolder });
        }

        if (expiration) {
            const renewDate = moment(expiration).subtract(5, 'hours');
            if (moment().isSameOrAfter(renewDate)) {
                return lib.registerWebhook(context);
            }
        }
    }
};

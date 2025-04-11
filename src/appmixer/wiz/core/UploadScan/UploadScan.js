const lib = require('../../lib');
const moment = require('moment');

module.exports = {

    start(context) {

        const { scheduleValue } = context.properties;
        if (scheduleValue) {
            return this.scheduleDrain(context, { previousDate: null });
        }
    },

    // docs: https://win.wiz.io/reference/pull-cloud-resources
    async receive(context) {

        const { threshold, scheduleValue } = context.properties;

        let lock;
        try {
            lock = await context.lock(context.componentId);

            const documents = await context.stateGet('documents') || [];

            if (context.messages.timeout) {
                await this.scheduleDrain(context);
                if (documents.length > 0) {
                    await this.sendDocuments(context, documents);
                }
                return;
            }

            const { document } = context.messages.in.content;
            documents.push(document);
            context.log({ step: 'documents in state:', count: documents.length });
            await context.stateSet('documents', documents);

            if (threshold && documents.length >= threshold) {
                return this.sendDocuments(context, documents);
            }
            if (!threshold && !scheduleValue) {
                return this.sendDocuments(context, documents);
            }

        } finally {
            if (lock) {
                lock.unlock();
            }
        }
    },

    async scheduleDrain(context) {

        const { scheduleValue, scheduleType } = context.properties;
        const now = moment();
        const referenceDate = moment();

        if (!['minutes', 'hours', 'days'].includes(scheduleType)) {
            throw new context.CancelError(`Invalid scheduleType: ${scheduleType}`);
        }

        const nextDate = referenceDate.add(scheduleValue, scheduleType);
        const diff = nextDate.diff(now);

        context.log({ step: 'schedule - diff', diff: diff / 1000 });
        await context.setTimeout({}, diff);
    },

    async sendDocuments(context, dataSources) {

        await context.stateUnset('documents');

        const { filename, integrationId } = context.messages.in.content;

        const { url, systemActivityId } = await lib.requestUpload(context, { filename });

        const fileContent = {
            integrationId,
            dataSources: dataSources
        };

        context.log({ step: 'filecontent', fileContent });
        await lib.uploadFile(context, { url, fileContent });
        const systemActivity = await lib.getStatus(context, systemActivityId);
        context.log({ step: 'systemActivity', systemActivity });

        // throw error if the system activity is not valid.
        lib.validateUploadStatus(context, { systemActivity });

        return context.sendJson(systemActivity, 'out');
    }
};


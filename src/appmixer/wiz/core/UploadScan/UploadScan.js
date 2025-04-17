const lib = require('../../lib');
const moment = require('moment');

const getLockConfiguration = (context) => {

    return {
        retryDelay: parseInt(context.config.uploadLockRetryDelay, 10) || 3000,
        ttl: parseInt(context.config.uploadLockTtl, 10) || 15 * 60 * 1000,
        maxRetryCount: parseInt(context.config.uploadLockMaxRetryCount, 10) || 60
    };
};

module.exports = {

    start(context) {

        context.log({
            step: 'start',
            lockConfiguration: getLockConfiguration(context)
        });

        const { scheduleValue } = context.properties;
        if (scheduleValue) {
            return this.scheduleDrain(context);
        }
    },

    // docs: https://win.wiz.io/reference/pull-cloud-resources
    async receive(context) {

        const { threshold, scheduleValue } = context.properties;

        let lock;
        try {

            // https://docs.appmixer.com/6.0/v4.1/component-definition/behaviour#async-context.lock-lockname-options
            lock = await context.lock(context.componentId, getLockConfiguration(context));

            context.log({ step: 'lock', lock });
            const documents = await context.stateGet('documents') || [];

            if (context.messages.timeout) {
                await this.scheduleDrain(context);
                if (documents.length > 0) {
                    const integrationId = await context.stateGet('integrationId');
                    const filename = await context.stateGet('filename');
                    await this.sendDocuments(context, { documents, filename, integrationId });
                }
                return;
            }

            const { document, filename, integrationId } = context.messages.in.content;
            documents.push(document);
            context.log({ step: 'documents in state:', count: documents.length });
            await context.stateSet('documents', documents);
            await context.stateSet('filename', filename);
            await context.stateSet('integrationId', integrationId);

            if (threshold && documents.length >= threshold) {
                await this.sendDocuments(context, { documents, filename, integrationId });
            } else if (!threshold && !scheduleValue) {
                await this.sendDocuments(context, { documents, filename, integrationId });
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

        await context.setTimeout({}, diff);
    },

    async sendDocuments(context, { documents, filename, integrationId }) {

        const { url, systemActivityId } = await lib.requestUpload(context, { filename });

        const fileContent = {
            integrationId,
            dataSources: documents
        };

        await lib.uploadFile(context, { url, fileContent });
        const systemActivity = await lib.getStatus(context, systemActivityId);

        await context.stateUnset('documents');
        // throw error if the system activity is not valid.
        lib.validateUploadStatus(context, { systemActivity });

        return context.sendJson(systemActivity, 'out');
    }
};


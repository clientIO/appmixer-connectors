'use strict';

const parser = require('cron-parser');
const moment = require('moment');

module.exports = {

    async receive(context) {

        const { threshold, generateOutputPortOptions, getWebhookUrl, outputType = 'array' } = context.properties;

        if (getWebhookUrl) {
            return context.sendJson({
                inputs: {
                    webhookUrl: {
                        defaultValue: context.getWebhookUrl()
                    }
                }
            }, 'out');
        }

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        let lock;
        try {
            lock = await context.lock(context.componentId);

            if (context.messages.webhook) {
                // Manually drained by webhook.
                const wrappedEntries = await context.stateGet('entries') || [];

                context.log({ step: 'wrappedEntries', wrappedEntries: wrappedEntries });

                const entries = wrappedEntries.map(e => e.data);
                await this.sendEntries(context, entries, outputType);
                await context.stateUnset('entries');
                return context.response();
            }

            if (context.messages.timeout) {
                const wrappedEntries = await context.stateGet('entries') || [];
                if (!threshold || (threshold && wrappedEntries.length >= threshold)) {
                    if (wrappedEntries.length > 0) {
                        const entries = wrappedEntries.map(e => e.data);
                        await this.sendEntries(context, entries, outputType);
                        await context.stateUnset('entries');
                    }
                }
                const previousDate = context.messages.timeout.content.previousDate;
                return this.scheduleDrain(context, { previousDate });
            }

            // Wrap entry with a unique ID and add to set
            const { entry } = context.messages.in.content;
            const wrappedEntry = {
                id: `${Date.now()}-${Math.random()}`,
                data: entry
            };
            await context.stateAddToSet('entries', wrappedEntry);

            // Check if threshold reached
            if (threshold) {
                const wrappedEntries = await context.stateGet('entries') || [];
                if (wrappedEntries.length >= threshold) {
                    const entries = wrappedEntries.map(e => e.data);
                    await this.sendEntries(context, entries, outputType);
                    await context.stateUnset('entries');
                }
            }

        } finally {
            if (lock) {
                lock.unlock();
            }
        }
    },

    async start(context) {

        const { minute, hour, dayMonth, dayWeek } = context.properties;

        if (minute || hour || dayMonth || dayWeek) {
            return this.scheduleDrain(context, { previousDate: null });
        }
    },

    async sendEntries(context, entries = [], outputType) {

        if (outputType === 'first') {
            if (entries.length) {
                await context.sendJson({ entry: entries[0], index: 0, count: entries.length }, 'out');
            }
        } else if (outputType === 'object') {
            for (let index = 0; index < entries.length; index++) {
                const entry = entries[index];
                await context.sendJson({ entry, index, count: entries.length }, 'out');
            }
        } else if (outputType === 'array') {
            return context.sendJson({ entries, count: entries.length }, 'out');
        } else if (outputType === 'file') {
            if (entries.length) {
                // Stored into CSV file.
                const headers = Object.keys(entries[0] || {});
                let csvRows = [];
                csvRows.push(headers.join(','));
                for (const entry of entries) {
                    const values = headers.map(header => {
                        const val = entry[header];
                        return `"${val}"`;
                    });
                    csvRows.push(values.join(','));
                }
                const csvString = csvRows.join('\n');
                let buffer = Buffer.from(csvString, 'utf8');
                const fileName = `utils-controls-Digest-${(new Date).toISOString()}.csv`;
                const savedFile = await context.saveFileStream(fileName, buffer);
                await context.sendJson({ fileId: savedFile.fileId, count: entries.length }, 'out');
            }
        }
    },

    async scheduleDrain(context, { previousDate = null }) {

        const { timezone, minute, hour, dayMonth, dayWeek } = context.properties;
        if (timezone && !moment.tz.zone(timezone)) {
            throw new context.CancelError('Invalid timezone');
        }

        const expression = `${minute || 0} ${hour || '*'} ${dayMonth || '*'} * ${dayWeek || '*'}`;
        const options = timezone ? { tz: timezone } : {};
        const interval = parser.parseExpression(expression, options);
        if (!interval.hasNext()) {
            throw new context.CancelError('Next scheduled date doesn’t exist');
        }

        const now = moment().toISOString();
        const nextDate = interval.next().toISOString();
        previousDate = previousDate ? moment(previousDate).toISOString() : null;

        const diff = moment(nextDate).diff(now);
        await context.setTimeout({ previousDate: now }, diff);
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'object' || outputType === 'first') {
            return context.sendJson([
                { label: 'Current Entry Index', value: 'index', schema: { type: 'integer' } },
                { label: 'Entries Count', value: 'count', schema: { type: 'integer' } },
                { label: 'Entry', value: 'entry' }
            ], 'out');
        } else if (outputType === 'array') {
            return context.sendJson([
                { label: 'Entries Count', value: 'count', schema: { type: 'integer' } },
                { label: 'Entries', value: 'entries', schema: { type: 'array' } }
            ], 'out');
        } else if (outputType === 'file') {
            return context.sendJson([
                { label: 'Entries Count', value: 'count', schema: { type: 'integer' } },
                { label: 'File ID', value: 'fileId', schema: { type: 'string', format: 'appmixer-file-id' } }
            ], 'out');
        }
    }
};

'use strict';

const parser = require('cron-parser');
const moment = require('moment');

module.exports = {

    async receive(context) {

        const { threshold, generateOutputPortOptions, outputType = 'array' } = context.properties;
        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }
        const entries = await context.stateGet('entries') || [];

        if (context.messages.timeout) {
            if (!threshold || (threshold && entries.length >= threshold)) {
                if (entries.length > 0) {
                    await this.sendEntries(context, entries, outputType);
                    await context.stateUnset('entries');
                }
            }
            const previousDate = context.messages.timeout.content.previousDate;
            return this.scheduleDrain(context, { previousDate });
        }

        const { entry } = context.messages.in.content;
        entries.push(entry);
        await context.stateSet('entries', entries);

        if (threshold) {
            if (entries.length >= threshold) {
                await this.sendEntries(context, entries, outputType);
                await context.stateUnset('entries');
            }
        }
    },

    async start(context) {

        const { minute, hour, dayMonth, dayWeek, timezone } = context.properties;

        if (minute || hour || dayMonth || dayWeek) {
            return this.scheduleDrain(context, { previousDate: null });
        }
    },

    async sendEntries(context, entries, outputType) {

        if (outputType === 'first') {
            if (entries.length) {
                await context.sendJson({ entry: entries[0] }, 'out');
            }
        } else if (outputType === 'object') {
            await Promise.map(entries, entry => {
                return context.sendJson({ entry }, 'out');
            });
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
                await context.sendJson({ fileId: savedFile.fileId }, 'out');
            }
        }
    },

    async scheduleDrain(context, { previousDate = null }) {

        let lock;
        const { timezone, minute, hour, dayMonth, dayWeek } = context.properties;
        if (timezone && !moment.tz.zone(timezone)) {
            throw new context.CancelError('Invalid timezone');
        }

        const expression = `${minute} ${hour} ${dayMonth} * ${dayWeek}`;
        const options = timezone ? { tz: timezone } : {};
        const interval = parser.parseExpression(expression, options);
        if (!interval.hasNext()) {
            throw new context.CancelError('Next scheduled date doesn\'t exist');
        }

        const now = moment().toISOString();
        const nextDate = interval.next().toISOString();
        previousDate = previousDate ? moment(previousDate).toISOString() : null;

        const state = await context.stateGet('state');
        const timeoutId = await context.stateGet('timeoutId');

        const diff = moment(nextDate).diff(now);
        await context.setTimeout({ previousDate: now }, diff);
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'object' || outputType === 'first') {
            return context.sendJson([
                { label: 'Entry', value: 'entry' }
            ], 'out');
        } else if (outputType === 'array') {
            return context.sendJson([
                { label: 'Entries', value: 'entries', schema: { type: 'array' } }
            ], 'out');
        } else if (outputType === 'file') {
            return context.sendJson([
                { label: 'File ID', value: 'fileId', schema: { type: 'string', format: 'appmixer-file-id' } }
            ], 'out');
        }
    }
};

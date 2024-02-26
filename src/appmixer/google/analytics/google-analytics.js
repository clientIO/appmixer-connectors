'use strict';
const querystring = require('querystring');

module.exports = {

    getHitURL(hitType, trackingId, params) {

        const version = 1;
        const userId = trackingId.substr(3, 9);  // refers to the user's account number
        const url = 'https://google-analytics.com/collect?payload_data&';

        const qs = querystring.stringify(Object.assign(
            { v: version, uid: userId, t: hitType, tid: trackingId }, params
        ));

        return url + qs;
    },

    batchGet: {

        validDate(ISOdate) {

            const today = new Date();
            const maxDate = today.toISOString().substr(0, 10);
            const minDate = '2005-11-15';  // Google Analytics launch date

            const dateAsInt = date => parseInt(date.split('-').join(''));
            const date = ISOdate.substr(0, 10);

            if (dateAsInt(date) < dateAsInt(minDate)) return minDate;
            if (dateAsInt(date) > dateAsInt(maxDate)) return maxDate;
            return date;
        },

        dateRange(startDate, endDate) {

            const dateRange = {};
            if (startDate) dateRange.startDate = this.validDate(startDate);
            if (endDate) dateRange.endDate = this.validDate(endDate);

            return dateRange;
        },

        reportRequest(viewId, input) {

            const requestBody = { viewId };

            // Add the metrics/dimensions expression
            const dataEntry = input.dataEntry.split('.');
            const key = dataEntry[0];
            requestBody[key] = key === 'metrics'
                ? { expression: dataEntry[1] }
                : { name: dataEntry[1] };

            // Add date ranges (if specified)
            if (input.startDate || input.endDate) {
                requestBody.dateRanges = [this.dateRange(input.startDate, input.endDate)];
            }

            return requestBody;
        },

        formatHeader(columnHeader) {

            const toSentenceCase = string => string.charAt(0).toUpperCase() + string.slice(1);
            const toTitleFormat = string => string.trim().slice(3).split(/(?=[A-Z])/).join(' ');

            const metricHeader = columnHeader.metricHeader.metricHeaderEntries[0].name;
            let header = toSentenceCase(toTitleFormat(metricHeader));

            if (columnHeader.dimensions) {
                header += `: ${toSentenceCase(toTitleFormat(columnHeader.dimensions[0]))}`;
            }

            return header;
        },

        getSummaryObj(data) {

            return {
                totalValues: data.totals[0].values[0],
                minimum: data.minimums ? data.minimums[0].values[0] : 'Not enough data available.',
                maximum: data.maximums ? data.maximums[0].values[0] : 'Not enough data available.'
            };
        },

        getRowsValues(data) {

            return data.rows ? data.rows.map(row => row.metrics[0].values[0]) : null;
        },

        getRecordsString(header, data) {

            const values = this.getRowsValues(data);
            const records = values ? values.join(', ') : 'Not enough data available.';

            return `${header}: ${records}`;
        },

        formatReport(report) {

            const header = this.formatHeader(report.columnHeader);
            const records = this.getRecordsString(header, report.data);
            const summary = this.getSummaryObj(report.data);

            return Object.assign({ header, records }, summary);
        }
    }
};

'use strict';

const pathModule = require('path');
const moment = require('moment');

const DEFAULT_PREFIX = 'zoho-crm-export';

// Zoho CRM API versions used by the components in this module.
//
// The connector's ZohoClient still defaults to v2 for backwards compatibility, but v2 is too old
// for two things the newer components need:
//   * SEARCH_API_VERSION - v2 /search only understands the `equals`, `starts_with` and `in`
//     comparators. Filtering by a date or date-time field (Due_Date, Appointment_Start_Time, ...)
//     needs `greater_equal` / `less_equal` / `between`, which arrived in v3.
//   * APPOINTMENTS_API_VERSION - the Appointments module is not exposed before v5.
const SEARCH_API_VERSION = 'v3';
const APPOINTMENTS_API_VERSION = 'v8';

// The out-of-the-box Appointments module is system defined, hence the `__s` suffix.
const APPOINTMENTS_MODULE = 'Appointments__s';

// From API v3 up, `fields` is mandatory when listing records of a module, so every Appointments
// read passes an explicit field list.
const APPOINTMENT_FIELDS = [
    'Appointment_Name',
    'Appointment_Start_Time',
    'Appointment_End_Time',
    'Duration',
    'Status',
    'Appointment_For',
    'Service_Name',
    'Location',
    'Address',
    'Additional_Information',
    'Owner',
    'Created_Time',
    'Modified_Time'
];

// Appointments.Status is one of the few Zoho picklists with a documented, non-customizable set of
// values. Every other picklist referenced by these components (Cases.Status, Quotes.Quote_Stage,
// Invoices.Status, ...) is organization specific and is therefore offered as a typeahead backed by
// the ListFields component instead of being hard-coded.
const APPOINTMENT_STATUS_SCHEDULED = 'Scheduled';
const APPOINTMENT_STATUS_CANCELLED = 'Cancelled';

const schemas = {

    appointment: {
        id: { type: 'string', title: 'ID', example: '4876876000000579001' },
        Appointment_Name: { type: 'string', title: 'Appointment Name', example: 'Annual service visit' },
        Appointment_Start_Time: { type: 'string', title: 'Start Time', example: '2026-09-14T10:00:00+00:00' },
        Appointment_End_Time: { type: 'string', title: 'End Time', example: '2026-09-14T10:30:00+00:00' },
        Duration: { type: 'integer', title: 'Duration (minutes)', example: 30 },
        Status: { type: 'string', title: 'Status', example: 'Scheduled' },
        Appointment_For: { type: 'object', title: 'Appointment For', example: { id: '4876876000000412001', name: 'Jane Doe', module: { api_name: 'Contacts' } } },
        Service_Name: { type: 'object', title: 'Service', example: { id: '4876876000000491001', name: 'Onsite inspection' } },
        Location: { type: 'string', title: 'Location', example: 'Client Address' },
        Address: { type: 'string', title: 'Address', example: '221B Baker Street, London' },
        Additional_Information: { type: 'string', title: 'Additional Information', example: 'Bring the replacement filter.' },
        Owner: { type: 'object', title: 'Owner', example: { id: '4876876000000306001', name: 'John Smith', email: 'john@example.com' } },
        Created_Time: { type: 'string', title: 'Created Time', example: '2026-09-01T09:12:44+00:00' },
        Modified_Time: { type: 'string', title: 'Modified Time', example: '2026-09-02T14:03:19+00:00' }
    },

    case: {
        id: { type: 'string', title: 'ID', example: '4876876000000624001' },
        Case_Number: { type: 'string', title: 'Case Number', example: '4876876000000624004' },
        Subject: { type: 'string', title: 'Subject', example: 'Printer stops after 20 pages' },
        Status: { type: 'string', title: 'Status', example: 'Closed' },
        Priority: { type: 'string', title: 'Priority', example: 'High' },
        Type: { type: 'string', title: 'Type', example: 'Problem' },
        Case_Origin: { type: 'string', title: 'Case Origin', example: 'Email' },
        Case_Reason: { type: 'string', title: 'Case Reason', example: 'Hardware failure' },
        Description: { type: 'string', title: 'Description', example: 'The device overheats and the job is cancelled.' },
        Internal_Comments: { type: 'string', title: 'Internal Comments', example: 'Escalated to the hardware team.' },
        Solution: { type: 'string', title: 'Solution', example: 'Replaced the fuser unit under warranty.' },
        Reported_By: { type: 'string', title: 'Reported By', example: 'Jane Doe' },
        Email: { type: 'string', title: 'Email', example: 'jane@example.com' },
        Phone: { type: 'string', title: 'Phone', example: '+44 20 7946 0958' },
        Account_Name: { type: 'object', title: 'Account', example: { id: '4876876000000388001', name: 'Acme Ltd.' } },
        Owner: { type: 'object', title: 'Case Owner', example: { id: '4876876000000306001', name: 'John Smith', email: 'john@example.com' } },
        Created_Time: { type: 'string', title: 'Created Time', example: '2026-08-20T08:30:00+00:00' },
        Modified_Time: { type: 'string', title: 'Modified Time', example: '2026-09-01T11:47:52+00:00' }
    },

    invoice: {
        id: { type: 'string', title: 'ID', example: '4876876000000701001' },
        Invoice_Number: { type: 'string', title: 'Invoice Number', example: 'INV-000123' },
        Subject: { type: 'string', title: 'Subject', example: 'Annual subscription renewal' },
        Status: { type: 'string', title: 'Status', example: 'Approved' },
        Invoice_Date: { type: 'string', title: 'Invoice Date', example: '2026-08-15' },
        Due_Date: { type: 'string', title: 'Due Date', example: '2026-09-14' },
        Account_Name: { type: 'object', title: 'Account', example: { id: '4876876000000388001', name: 'Acme Ltd.' } },
        Contact_Name: { type: 'object', title: 'Contact', example: { id: '4876876000000412001', name: 'Jane Doe' } },
        Sub_Total: { type: 'number', title: 'Sub Total', example: 1200 },
        Grand_Total: { type: 'number', title: 'Grand Total', example: 1440 },
        Discount: { type: 'number', title: 'Discount', example: 0 },
        Adjustment: { type: 'number', title: 'Adjustment', example: 0 },
        Currency: { type: 'string', title: 'Currency', example: 'GBP' },
        Exchange_Rate: { type: 'number', title: 'Exchange Rate', example: 1 },
        Terms_and_Conditions: { type: 'string', title: 'Terms and Conditions', example: 'Payment due within 30 days.' },
        Description: { type: 'string', title: 'Description', example: 'Renewal for the 2026/2027 period.' },
        Owner: { type: 'object', title: 'Invoice Owner', example: { id: '4876876000000306001', name: 'John Smith', email: 'john@example.com' } },
        Created_Time: { type: 'string', title: 'Created Time', example: '2026-08-15T09:00:00+00:00' },
        Modified_Time: { type: 'string', title: 'Modified Time', example: '2026-08-16T09:00:00+00:00' }
    },

    quote: {
        id: { type: 'string', title: 'ID', example: '4876876000000655001' },
        Quote_Number: { type: 'string', title: 'Quote Number', example: 'QT-000045' },
        Subject: { type: 'string', title: 'Subject', example: 'Quote for 25 licences' },
        Quote_Stage: { type: 'string', title: 'Quote Stage', example: 'Confirmed' },
        Valid_Till: { type: 'string', title: 'Valid Till', example: '2026-10-01' },
        Carrier: { type: 'string', title: 'Carrier', example: 'FedEx' },
        Team: { type: 'string', title: 'Team', example: 'EMEA Sales' },
        Account_Name: { type: 'object', title: 'Account', example: { id: '4876876000000388001', name: 'Acme Ltd.' } },
        Contact_Name: { type: 'object', title: 'Contact', example: { id: '4876876000000412001', name: 'Jane Doe' } },
        Deal_Name: { type: 'object', title: 'Deal', example: { id: '4876876000000501001', name: 'Acme - 25 licences' } },
        Sub_Total: { type: 'number', title: 'Sub Total', example: 2500 },
        Grand_Total: { type: 'number', title: 'Grand Total', example: 3000 },
        Discount: { type: 'number', title: 'Discount', example: 0 },
        Adjustment: { type: 'number', title: 'Adjustment', example: 0 },
        Terms_and_Conditions: { type: 'string', title: 'Terms and Conditions', example: 'Prices are valid for 30 days.' },
        Description: { type: 'string', title: 'Description', example: 'Includes onboarding support.' },
        Owner: { type: 'object', title: 'Quote Owner', example: { id: '4876876000000306001', name: 'John Smith', email: 'john@example.com' } },
        Created_Time: { type: 'string', title: 'Created Time', example: '2026-08-25T10:15:00+00:00' },
        Modified_Time: { type: 'string', title: 'Modified Time', example: '2026-08-28T16:40:00+00:00' }
    }
};

module.exports = {

    SEARCH_API_VERSION,
    APPOINTMENTS_API_VERSION,
    APPOINTMENTS_MODULE,
    APPOINTMENT_FIELDS,
    APPOINTMENT_STATUS_SCHEDULED,
    APPOINTMENT_STATUS_CANCELLED,
    schemas,

    /**
     * Joins Zoho search criteria into the `((a)and(b))` form the /search endpoint expects.
     * Falsy entries are dropped so callers can build the list with inline conditionals.
     * @param {Array<string|null>} criteria e.g. ['(Due_Date:equals:2026-09-14)']
     * @returns {string|null} null when there is nothing to filter on.
     */
    buildCriteria(criteria = []) {

        const parts = criteria.filter(Boolean);
        if (!parts.length) {
            return null;
        }
        if (parts.length === 1) {
            return parts[0];
        }
        return `(${parts.join('and')})`;
    },

    /**
     * Escapes a value used inside a search criteria expression. Zoho requires the characters that
     * delimit the expression itself to be backslash escaped.
     * @param {string} value
     * @returns {string}
     */
    escapeCriteriaValue(value) {

        return String(value).replace(/([(),\\])/g, '\\$1');
    },

    /**
     * Formats a date as the plain `YYYY-MM-DD` Zoho uses for Date (not DateTime) fields.
     * A string keeps the calendar day it was written with: the date-time inspector sends the
     * user's local midnight with an offset (2026-09-14T00:00:00+02:00), and converting that to UTC
     * first would shift the filter to the previous day.
     */
    formatDate(date) {

        if (typeof date === 'string') {
            const parsed = moment.parseZone(date, moment.ISO_8601);
            if (parsed.isValid()) {
                return parsed.format('YYYY-MM-DD');
            }
        }
        return moment.utc(date).format('YYYY-MM-DD');
    },

    /** Formats a date as the ISO 8601 with offset form Zoho uses for DateTime fields. */
    formatDateTime(date) {

        return moment(date).utc().format('YYYY-MM-DDTHH:mm:ss[+00:00]');
    },

    /**
     * The current calendar day in the given IANA time zone, returned as UTC midnight of that day so
     * formatDate() yields the local date. Zoho Date fields (Due_Date, ...) carry no time zone and
     * follow the organization's calendar, so "today" must not be the UTC day: for a UTC-7 user the
     * UTC day flips at 17:00 local time. Falls back to UTC when the zone is missing or unknown.
     * @param {string} [timeZone] e.g. 'America/Los_Angeles'
     */
    startOfToday(timeZone) {

        let today = moment.utc().format('YYYY-MM-DD');
        if (timeZone) {
            try {
                // en-CA formats as YYYY-MM-DD.
                today = new Intl.DateTimeFormat('en-CA', {
                    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
                }).format(new Date());
            } catch (err) {
                // Unknown time zone id - keep the UTC day.
            }
        }
        return moment.utc(today, 'YYYY-MM-DD').toDate();
    },

    /**
     * First record matching a search, reading a single page (per_page=1). The triggers' test() needs
     * one sample that matches the same criteria as tick(), without paging through the module.
     * @param {ZohoClient} client
     * @param {string} moduleName
     * @param {Object} params Search params (`criteria`, `fields`, ...).
     * @returns {Promise<Object|null>}
     */
    async searchFirst(client, moduleName, params) {

        // eslint-disable-next-line camelcase
        const response = await client.request('GET', client.path(`/${moduleName}/search`), { params: { ...params, per_page: 1 } });
        return Array.isArray(response?.data) ? response.data[0] : null;
    },

    /** Time zone of the connected Zoho user (users API `time_zone`, stored in the account profile). */
    userTimeZone(context) {

        return context.profileInfo?.time_zone;
    },

    /**
     * Shifts a date by whole days. Negative values move into the past. A plain `YYYY-MM-DD` string
     * is read as UTC midnight, matching startOfToday().
     */
    addDays(date, days) {

        return moment.utc(date).add(days, 'days').toDate();
    },

    async sendArrayOutput({ context, outputPortName = 'out', outputType = 'array', records = [] }) {

        if (outputType === 'first') {
            if (records.length === 0) {
                throw new context.CancelError('No records available for first output type');
            }
            await context.sendJson(
                { ...records[0], index: 0, count: records.length },
                outputPortName
            );
        } else if (outputType === 'object') {
            for (let index = 0; index < records.length; index++) {
                await context.sendJson(
                    { ...records[index], index, count: records.length },
                    outputPortName
                );
            }
        } else if (outputType === 'array') {
            await context.sendJson({ result: records, count: records.length }, outputPortName);
        } else if (outputType === 'file') {
            const csvString = toCsv(records);
            const buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || DEFAULT_PREFIX}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    getOutputPortOptions(context, outputType, itemSchema, { label, value }) {

        if (outputType === 'object' || outputType === 'first') {
            const options = Object.keys(itemSchema)
                .reduce((res, field) => {
                    const schema = itemSchema[field];
                    const { title: fieldLabel, ...schemaWithoutTitle } = schema;
                    res.push({ label: fieldLabel, value: field, schema: schemaWithoutTitle });
                    return res;
                }, [{
                    label: 'Current Item Index',
                    value: 'index',
                    schema: { type: 'integer' }
                }, {
                    label: 'Items Count',
                    value: 'count',
                    schema: { type: 'integer' }
                }]);
            return context.sendJson(options, 'out');
        }

        if (outputType === 'array') {
            return context.sendJson([{
                label,
                value,
                schema: {
                    type: 'array',
                    items: { type: 'object', properties: itemSchema }
                }
            }, { label: 'Items Count', value: 'count', schema: { type: 'integer' } }], 'out');
        }

        if (outputType === 'file') {
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};

// Every cell is quoted so values containing commas, quotes or newlines (descriptions, addresses,
// JSON of lookup fields) cannot shift columns or rows. Cells are read by header, not by position,
// because Zoho omits empty fields per record.
const toCsv = (array) => {

    if (!array || !array.length) {
        return '';
    }
    const headers = Object.keys(array[0]);
    const escapeCell = (value) => {
        const text = value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
        return `"${text.replace(/"/g, '""')}"`;
    };
    return [
        headers.map(escapeCell).join(','),
        ...array.map(item => headers.map(header => escapeCell(item[header])).join(','))
    ].join('\n');
};

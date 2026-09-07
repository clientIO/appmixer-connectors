const SalesforceAPI = require('jsforce');
const pathModule = require('path');
const crypto = require('crypto');
const DEFAULT_API_VERSION = '58.0';

/**
 * Stable cache key for cached dynamic-source (dropdown) calls.
 * @param {Object} obj - anything JSON-serializable that identifies the call
 * @return {string}
 */
function getSourceCacheKey(obj) {
    return 'salesforce_source_' + crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

module.exports = {

    // Expects standardized outputType: 'object', 'array', 'file'
    async sendArrayOutput({ context, outputPortName = 'out', outputType = 'array', records = [] }) {
        if (outputType === 'object') {
            // One by one.
            await context.sendArray(records, outputPortName);
        } else if (outputType === 'array') {
            // All at once.
            await context.sendJson({ result: records }, outputPortName);
        } else if (outputType === 'file') {

            // Into CSV file.
            const csvString = toCsv(records);

            let buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || 'salesforce-objects-export'}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);

            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    /**
     * Get new SalesforceAPI
     * @param context - Appmixer context object.
     * @returns {*}
     */
    getSalesforceAPI(context) {

        const instanceUrl = context.profileInfo.instanceUrl;
        const accessToken = context.auth.accessToken;
        const version = context.config.apiVersion || DEFAULT_API_VERSION;

        return new SalesforceAPI.Connection({
            instanceUrl,
            accessToken,
            version
        });
    },

    Date: SalesforceAPI.Date,

    /**
     * Fetch all Account records via the jsforce SDK.
     * @param {Object} context
     * @return {Promise<Array>}
     */
    listAccounts(context) {

        const client = this.getSalesforceAPI(context);
        return client.sobject('Account').find();
    },

    /**
     * Shared cache wrapper for dynamic-source (dropdown) calls, so repeated
     * inspector openings do not burn the Salesforce request quota. Keyed by
     * the access token — a token refresh naturally invalidates the cache.
     * @param {Object} context
     * @param {Object} params - { resource, ttlConfigKey, fetch }
     * @return {Promise<*>} the fetch() result, possibly served from cache
     */
    async cachedSource(context, { resource, ttlConfigKey, fetch }) {

        const key = getSourceCacheKey({ resource, token: context.auth.accessToken });
        let lock;
        try {
            lock = await context.lock(key);
            const cached = await context.staticCache.get(key);
            if (cached) return cached;

            const result = await fetch();
            const ttl = (ttlConfigKey && context.config[ttlConfigKey]) || (5 * 60 * 1000);
            await context.staticCache.set(key, result, ttl);
            return result;
        } finally {
            lock?.unlock();
        }
    },

    /**
     * Cached variant of listAccounts for dynamic-source (dropdown) calls.
     * @param {Object} context
     * @return {Promise<Array>}
     */
    listAccountsCached(context) {

        return this.cachedSource(context, {
            resource: 'accounts',
            ttlConfigKey: 'listAccountsCacheTTL',
            fetch: () => this.listAccounts(context)
        });
    },

    /**
     * Fetch the single newest record of an sObject via the jsforce SDK, ordered by
     * CreatedDate descending. Shared by the New* triggers' test() methods so the emitted
     * record goes through the exact same SDK query path as tick() (minus the `since`
     * baseline filter, which would suppress output on a fresh poll).
     * @param {Object} context - Appmixer context object.
     * @param {string} objectName - Salesforce sObject name (e.g. 'Lead').
     * @return {Promise<Object|null>} the newest record or null when none exist.
     */
    async findLatestSObject(context, objectName) {

        const client = this.getSalesforceAPI(context);
        const res = await client.sobject(objectName)
            .find({})
            .sort({ CreatedDate: -1 })
            .limit(1);
        return (Array.isArray(res) && res.length) ? res[0] : null;
    },

    /**
     * Salesforce has a weird datetime format '2017-04-28T16:18:47.000+0000', but AJV
     * schema validator does not buy that, so let's reformat to ISO.
     * @param {string} date
     * @return {string}
     */
    formatDate(date) {

        if (!date) {
            return date;
        }
        return new Date(date).toISOString();
    },

    /**
     * Go through certain record fields and apply format function.
     * @param {Object} record - salesforce record - contact, ...
     * @param {Array} fields - array with field names to be formatted
     * @param {function} formatFunc
     * @return {Object} record
     */
    formatFields(record, fields, formatFunc) {

        fields.forEach(field => {
            record[field] = formatFunc(record[field]);
        });
        return record;
    },

    /**
     * Escape a value so it can be safely embedded in a SOQL string literal.
     * Backslashes must be escaped first — a trailing backslash in the value
     * would otherwise escape the literal's closing quote and let the rest of
     * the query be injected into the string.
     * @param {*} value
     * @return {string}
     */
    escapeSoql(value) {

        return String(value).replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
    },

    /**
     * Escape a value so it can be safely embedded in a SOQL LIKE pattern.
     * On top of the quote escaping, the LIKE wildcards % (any sequence) and
     * _ (any single character) must be escaped too, so that user input is
     * matched literally — the caller then adds its own wildcards around the
     * escaped value (e.g. `'%' + escapeSoqlLike(v) + '%'` for a contains
     * match). Note that SOQL only supports LIKE on text fields; using it on
     * an ID, number or date field makes Salesforce reject the query.
     * @param {*} value
     * @return {string}
     */
    escapeSoqlLike(value) {

        return this.escapeSoql(value).replace(/([%_])/g, '\\$1');
    },

    /**
     * Validate that a value is a safe Salesforce API identifier (object or
     * field name) before interpolating it into a SOQL query. Salesforce API
     * names start with a letter and contain only letters, digits and
     * underscores, so this rejects SOQL injection and relationship paths like
     * `Owner.Name` (which the diff logic could not handle anyway).
     * @param {*} value
     * @param {string} label - human readable name used in the error message
     * @return {string} the validated identifier
     */
    assertSafeIdentifier(value, label) {

        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(String(value))) {
            throw new Error(`Invalid ${label}: "${value}". Only Salesforce API names (letters, digits and underscores) are supported.`);
        }
        return value;
    },

    /**
     * Common Salesforce datetime fields present on standard objects. Used to
     * reformat values to ISO before emitting (Salesforce returns a non-ISO
     * datetime format that the AJV schema validator rejects).
     */
    COMMON_DATE_FIELDS: [
        'CreatedDate',
        'LastModifiedDate',
        'SystemModstamp',
        'LastViewedDate',
        'LastReferencedDate',
        'LastActivityDate',
        'EmailBouncedDate',
        'LastCURequestDate',
        'LastCUUpdateDate',
        'CloseDate',
        'ConvertedDate'
    ],

    /**
     * Reformat the common Salesforce datetime fields of a record to ISO. Only
     * fields actually present (and truthy) on the record are touched.
     * @param {Object} record
     * @return {Object} record
     */
    formatSalesforceDates(record) {

        this.COMMON_DATE_FIELDS.forEach(field => {
            if (record[field]) {
                record[field] = this.formatDate(record[field]);
            }
        });
        return record;
    },

    /**
     * Standard Contact fields selected by the Get Contacts components. Kept as an
     * explicit list (instead of FIELDS(ALL)) so the SOQL query is not bound by the
     * 200 record limit Salesforce imposes on FIELDS(ALL) queries, and so the output
     * shape stays predictable for the variable picker.
     */
    CONTACT_FIELDS: [
        'Id',
        'AccountId',
        'FirstName',
        'LastName',
        'Name',
        'Salutation',
        'Title',
        'Department',
        'Email',
        'Phone',
        'MobilePhone',
        'HomePhone',
        'Fax',
        'MailingStreet',
        'MailingCity',
        'MailingState',
        'MailingPostalCode',
        'MailingCountry',
        'OwnerId',
        'LeadSource',
        'Description',
        'CreatedDate',
        'LastModifiedDate'
    ],

    /**
     * Run a SOQL query and return every matching record, following Salesforce's
     * query pagination (nextRecordsUrl) until the whole result set is fetched.
     * @param {Object} context
     * @param {string} soql
     * @return {Promise<Array>}
     */
    async queryAll(context, soql) {

        const records = [];
        let { data } = await this.api.salesForceRq(context, {
            action: `query?q=${encodeURIComponent(soql)}`
        });
        records.push(...((data && data.records) || []));

        // nextRecordsUrl looks like /services/data/vXX.0/query/01g...-2000; rebuild
        // the action relative to the data service so salesForceRq can reissue it
        // with the configured API version.
        while (data && data.done === false && data.nextRecordsUrl) {
            const action = 'query' + data.nextRecordsUrl.split('/query')[1];
            ({ data } = await this.api.salesForceRq(context, { action }));
            records.push(...((data && data.records) || []));
        }

        return records;
    },

    /**
     * Fetch all Campaign records.
     * @param {Object} context
     * @return {Promise<Array>}
     */
    async listCampaigns(context) {

        const client = this.getSalesforceAPI(context);
        const records = await client.sobject('Campaign')
            .find({}, { Id: 1, Name: 1, IsActive: 1, Status: 1, Type: 1, StartDate: 1, EndDate: 1 })
            .sort({ Name: 1 });
        // Strip the SDK's `attributes` envelope — it is not part of the declared
        // output and its JSON (with commas) corrupts the CSV file mode.
        return (records || []).map(({ attributes, ...rest }) => rest);
    },

    /**
     * Cached variant of listCampaigns for dynamic-source (dropdown) calls.
     * @param {Object} context
     * @return {Promise<Array>}
     */
    listCampaignsCached(context) {

        return this.cachedSource(context, {
            resource: 'campaigns',
            ttlConfigKey: 'listCampaignsCacheTTL',
            fetch: () => this.listCampaigns(context)
        });
    },

    /**
     * Fetch Contact records (with the standard CONTACT_FIELDS) matching an
     * optional SOQL WHERE clause, newest first, with datetime fields reformatted
     * to ISO. The caller is responsible for building a safe WHERE clause.
     * `extraFields` lets a caller add validated field names to the SELECT list
     * (e.g. the filtered custom field, so its value appears in the output).
     * @param {Object} context
     * @param {Object} params - { where, extraFields }
     * @return {Promise<Array>}
     */
    async findContacts(context, { where, extraFields = [] } = {}) {

        const fields = [...this.CONTACT_FIELDS];
        extraFields.forEach(field => {
            if (field && !fields.includes(field)) {
                fields.push(this.assertSafeIdentifier(field, 'field name'));
            }
        });
        let soql = `SELECT ${fields.join(', ')} FROM Contact`;
        if (where) {
            soql += ` WHERE ${where}`;
        }
        soql += ' ORDER BY LastModifiedDate DESC';

        const records = await this.queryAll(context, soql);
        // Strip the REST envelope's `attributes` object — it is not part of the
        // declared output and its JSON (with commas) corrupts the CSV file mode.
        return records.map(record => {
            // eslint-disable-next-line no-unused-vars
            const { attributes, ...rest } = record;
            return this.formatSalesforceDates(rest);
        });
    },

    /**
     * Emit the output port options for the Get Contacts components based on the
     * chosen outputType (mirrors the pattern used by Query and ListObjects).
     * @param {Object} context
     * @param {string} outputType
     */
    getContactOutputPortOptions(context, outputType) {

        if (outputType === 'object') {
            const output = this.CONTACT_FIELDS.map(field => ({ label: field, value: field }));
            return context.sendJson(output, 'out');
        } else if (outputType === 'array') {
            return context.sendJson([{ label: 'Result', value: 'result' }], 'out');
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    },

    /**
     * Build the initial { recordId: fieldValue } map of a monitored field, used
     * by a status/field-change trigger's start() to seed known state.
     * Optionally scoped to a single record.
     * @param {Object} context
     * @param {Object} params - { objectName, fieldName, recordId }
     * @return {Promise<Object>}
     */
    async getFieldValueMap(context, { objectName, fieldName, recordId }) {

        this.assertSafeIdentifier(objectName, 'object name');
        this.assertSafeIdentifier(fieldName, 'field name');
        const where = recordId ? ` WHERE Id = '${this.escapeSoql(recordId)}'` : '';
        const soql = `SELECT Id,${fieldName} FROM ${objectName}${where}`;
        const { data } = await this.api.salesForceRq(context, {
            method: 'GET',
            action: `query?q=${encodeURIComponent(soql)}`
        });

        const map = {};
        ((data && data.records) || []).forEach(record => {
            map[record['Id']] = record[fieldName];
        });
        return map;
    },

    /**
     * Fetch full records of an object modified since the given date, newest
     * first. Optionally scoped to a single record.
     * @param {Object} context
     * @param {Object} params - { objectName, since, recordId, limit }
     * @return {Promise<Array>}
     */
    async getModifiedRecords(context, { objectName, since, recordId, limit = 200 }) {

        this.assertSafeIdentifier(objectName, 'object name');
        // The query below selects all fields via SOQL FIELDS(ALL), which
        // Salesforce only allows as a *bounded* query: it requires a LIMIT of
        // at most 200 (and rejects nextRecordsUrl-style pagination). Requesting
        // more than 200 makes the API reject the query outright, so the limit is
        // capped at 200 here. Records are ordered newest-first so the most
        // recent changes in a tick window are never the ones dropped.
        let where = `LastModifiedDate >= ${this.Date.toDateTimeLiteral(since)}`;
        if (recordId) {
            where += ` AND Id = '${this.escapeSoql(recordId)}'`;
        }
        const soql = `SELECT FIELDS(ALL) FROM ${objectName} WHERE ${where} ORDER BY LastModifiedDate DESC LIMIT ${limit}`;
        const { data } = await this.api.salesForceRq(context, {
            method: 'GET',
            action: `query?q=${encodeURIComponent(soql)}`
        });

        return (data && data.records) || [];
    },

    /**
     * Fetch the single most recently modified record of an object. Optionally
     * scoped to a single record. Used by trigger test() methods to emit one
     * realistic item for Flow Test Mode.
     * @param {Object} context
     * @param {Object} params - { objectName, recordId }
     * @return {Promise<Object|null>}
     */
    async getLatestRecord(context, { objectName, recordId }) {

        this.assertSafeIdentifier(objectName, 'object name');
        const where = recordId ? ` WHERE Id = '${this.escapeSoql(recordId)}'` : '';
        const soql = `SELECT FIELDS(ALL) FROM ${objectName}${where} ORDER BY LastModifiedDate DESC LIMIT 1`;
        const { data } = await this.api.salesForceRq(context, {
            method: 'GET',
            action: `query?q=${encodeURIComponent(soql)}`
        });

        return ((data && data.records) || [])[0] || null;
    },

    /**
     * Shared start() for status/field-change triggers: seed the known value of
     * the monitored field for every (optionally a single) record.
     */
    async runFieldChangeStart(context, { objectName, fieldName, recordId }) {

        const known = await this.getFieldValueMap(context, { objectName, fieldName, recordId });
        await context.saveState({ known });
    },

    /**
     * Shared tick() for status/field-change triggers: emit each modified record
     * whose monitored field value changed since the previous tick.
     */
    async runFieldChangeTick(context, { objectName, fieldName, recordId, outputPortName }) {

        const since = new Date();
        const lastSince = context.state.since || since;

        const records = await this.getModifiedRecords(context, {
            objectName,
            since: lastSince,
            recordId
        });

        const known = context.state.known || {};
        const newKnown = { ...known };
        const triggered = [];

        records.forEach(record => {
            const id = record['Id'];
            const prev = known[id];
            const curr = record[fieldName];
            // Only emit when we knew a previous value and it actually changed.
            if (prev !== undefined && prev !== curr) {
                triggered.push(record);
            }
            newKnown[id] = curr;
        });

        await Promise.all(triggered.map(record => {
            return context.sendJson(this.formatSalesforceDates(record), outputPortName);
        }));

        await context.saveState({ known: newKnown, since });
    },

    // API
    api: {
        async getObjectFields(context, { objectName, cache = false }) {
            let fields = [];

            if (!cache) {
                const { data } = await this.salesForceRq(context, { action: `sobjects/${objectName}/describe` });
                return data?.fields || [];
            }

            const objectPropertiesCacheTTL = context.config.objectPropertiesCacheTTL || (5 * 60 * 1000);
            const cacheKey = 'salesforce_properties_objectFields_' + objectName + '_' + context.auth.userId + context.auth.profileInfo.email;
            let lock;
            try {
                lock = await context.lock(cacheKey);
                const cached = await context.staticCache.get(cacheKey);
                if (cached) {
                    fields = cached;
                } else {
                    const { data } = await this.salesForceRq(context, { action: `sobjects/${objectName}/describe` });

                    fields = data?.fields || [];

                    await context.staticCache.set(cacheKey, fields, objectPropertiesCacheTTL);
                }
                return fields;
            } finally {
                lock?.unlock();
            }
        },

        async createObject(context, { objectName, json }) {
            const { data } = await this.salesForceRq(context, {
                method: 'POST',
                action: `sobjects/${objectName}`,
                data: JSON.stringify(json),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return data;
        },

        async salesForceRq(context, { method = 'GET', headers = {}, data, action, service = 'data' }) {

            const version = `v${context.config.apiVersion || DEFAULT_API_VERSION}`;

            return await context.httpRequest({
                method,
                url: `${context.profileInfo.instanceUrl}/services/${service}/${version}/${action}`,
                data,
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`,
                    ...headers
                }
            });
        }
    }
};

/**
 * @param {array} array
 * @returns {string}
 */
const toCsv = (array) => {
    const headers = Object.keys(array[0]);

    return [
        headers.join(','),

        ...array.map(items => {
            return Object.values(items).map(property => {
                if (typeof property === 'object') {
                    return JSON.stringify(property);
                }
                return property;
            }).join(',');
        })

    ].join('\n');
};

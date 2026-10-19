'use strict';

const crypto = require('crypto');
const pathModule = require('path');

// OAuth client_credentials tokens are accepted by the v3 Core API only. /api/v2 is the legacy
// WSSE API, which SAP sunsets at the end of 2026 and which this connector deliberately does not
// support.
const CORE_API_BASE = 'https://api.emarsys.net/api/v3';
// Loyalty is a separate product: its own host, its own x-api-key, and the Core token is rejected.
const LOYALTY_API_BASE = 'https://contact-api.loyalsys.io/api/v4';
const DEFAULT_TOKEN_URL = 'https://auth.emarsys.net/oauth2/token';
// Field labels are translated per language; the connector keys its output by the
// language-independent string_id, so this only affects the labels shown in pickers.
const DEFAULT_LANGUAGE = 'en';
// contact/query caps `limit` at 10000 rows per page.
const QUERY_PAGE_SIZE = 10000;
// contact/getdata accepts at most 1000 keyValues per call ("1000 objects per batch"), so reading
// one page of query results back takes several getdata calls.
const GETDATA_CHUNK_SIZE = 1000;
const DEFAULT_LIST_CACHE_TTL = 2 * 60 * 1000;
const DEFAULT_REQUEST_TIMEOUT = 60 * 1000;
const MAX_REQUEST_TIMEOUT = 2 * 60 * 1000;
// A webhook node retries a failed delivery for a long time and can redeliver a contact, so the
// dedupe window has to outlive its backoff schedule (30s..10min, 11 attempts).
const WEBHOOK_DEDUPE_TTL = 2 * 60 * 60 * 1000;
const DEFAULT_PREFIX = 'emarsys-export';

// Emarsys answers HTTP 200 for "the request was fine but the contact is not there", reporting it
// per key in data.errors. 2008 is that case; 2010 means the key matched several contacts.
const ERROR_NO_CONTACT_FOUND = 2008;
const ERROR_MULTIPLE_CONTACTS = 2010;
// contact/query rejects a filter on a non-indexed column with 2015 — a support ticket, not
// something the flow can recover from, so say so instead of surfacing a bare 400.
const ERROR_FIELD_NOT_FILTERABLE = 2015;

const lib = {

    CORE_API_BASE,
    DEFAULT_TOKEN_URL,
    DEFAULT_LANGUAGE,

    // Upper bound so a hung Emarsys endpoint cannot hold a single receive() call open forever.
    getRequestTimeout(context) {

        const configured = parseInt(context && context.config && context.config.requestTimeout, 10);
        if (!configured || configured <= 0) {
            return DEFAULT_REQUEST_TIMEOUT;
        }
        return Math.min(configured, MAX_REQUEST_TIMEOUT);
    },

    normalizeTokenUrl(tokenUrl) {
        return ((tokenUrl || '').toString().trim()) || DEFAULT_TOKEN_URL;
    },

    maskSecret(value) {
        const text = (value || '').toString();
        return text.length > 6 ? `${text.slice(0, 3)}...${text.slice(-3)}` : text;
    },

    /**
     * Perform an Emarsys Core API v3 request and unwrap its `{ replyCode, replyText, data }`
     * envelope. Rejects a non-zero replyCode as a CancelError, because every documented non-zero
     * code is a permanent client-side problem (bad field, bad key, missing permission) that
     * retrying cannot fix.
     * @param {object} context
     * @param {object} options - { method, url, params, data }
     * @returns {Promise<object>} The whole envelope, so callers can also read data.errors.
     */
    async coreRequest(context, { method = 'GET', url, params, data } = {}) {

        // The inspector can call a component before an account is bound; say so rather than
        // letting the missing token surface as a TypeError.
        const token = (context.auth && context.auth.token) || '';
        if (!token) {
            throw new context.CancelError('No Emarsys account is connected.');
        }

        const request = {
            method,
            url: /^https?:\/\//.test(url) ? url : `${CORE_API_BASE}${url}`,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            params,
            timeout: lib.getRequestTimeout(context)
        };
        if (data !== undefined) {
            request.data = data;
        }

        let body;
        try {
            const response = await context.httpRequest(request);
            body = response.data;
        } catch (err) {
            throw lib.toEmarsysError(context, err);
        }

        const replyCode = body && body.replyCode;
        if (replyCode !== undefined && replyCode !== null && Number(replyCode) !== 0) {
            throw new context.CancelError(lib.describeReplyCode(Number(replyCode), body.replyText));
        }

        return body || {};
    },

    /**
     * Perform an Emarsys Loyalty API request. Separate host and separate credential from the Core
     * API, and no reply envelope — the contact object is the body.
     * @param {object} context
     * @param {object} options - { method, url, params, headers }
     * @returns {Promise<object>} The axios-style response, so callers can branch on the status.
     */
    async loyaltyRequest(context, { method = 'GET', url, params, headers = {} } = {}) {

        const apiKey = (context.auth.loyaltyApiKey || '').toString().trim();
        if (!apiKey) {
            throw new context.CancelError(
                'This component needs a Loyalty API Key. Emarsys Loyalty is a separate API with its own key — '
                + 'add it to the connected Emarsys account (Loyalty Configuration > API Key in Emarsys).');
        }

        try {
            return await context.httpRequest({
                method,
                url: `${LOYALTY_API_BASE}${url}`,
                headers: { 'x-api-key': apiKey, ...headers },
                params,
                timeout: lib.getRequestTimeout(context),
                // 404 is a normal "this contact has no loyalty record" answer — the caller routes
                // it to notFound, so it must not be thrown here.
                validateStatus: status => (status >= 200 && status < 300) || status === 404
            });
        } catch (err) {
            throw lib.toLoyaltyError(context, err);
        }
    },

    // The Loyalty API's failures all come down to one of three setup mistakes, and none of them is
    // obvious from the bare status code.
    toLoyaltyError(context, err) {

        const status = err && err.response && err.response.status;

        if (status === 401 || status === 403) {
            return new context.CancelError(
                'Emarsys Loyalty rejected the Loyalty API Key. It is created under Loyalty Configuration > API Key '
                + 'and is a different key from the Core API Client Secret.');
        }
        if (status === 400) {
            return new context.CancelError(
                'Emarsys Loyalty rejected the contact ID. It must be the contact\'s externalId (the identifier used '
                + 'in the Smart Insight sales data upload), not the Emarsys internal contact ID.');
        }
        return err;
    },

    // Turn an HTTP failure into a message that names the cause. A missing endpoint permission is
    // by far the most common setup mistake and shows up as a bare 403 with no replyCode.
    toEmarsysError(context, err) {

        const status = err && err.response && err.response.status;
        const body = err && err.response && err.response.data;
        const replyCode = body && body.replyCode !== undefined ? Number(body.replyCode) : null;
        const replyText = (body && body.replyText) || (err && err.message) || '';

        if (status === 403) {
            return new context.CancelError(
                'Emarsys returned 403 Forbidden. Endpoint permissions are disabled by default — grant this '
                + 'API credential the permissions it needs in Management > Security Settings > API Credentials.');
        }
        if (status === 401) {
            return new context.CancelError('Emarsys rejected the credentials (401). Reconnect the account.');
        }
        if (replyCode) {
            return new context.CancelError(lib.describeReplyCode(replyCode, replyText));
        }
        return err;
    },

    describeReplyCode(replyCode, replyText) {

        const suffix = replyText ? `: ${replyText}` : '';
        if (replyCode === ERROR_FIELD_NOT_FILTERABLE) {
            return `Emarsys cannot filter on that field (error ${replyCode}${suffix}). Filtering only works on `
                + 'indexed columns — id, uid, email and externalId are indexed by default; ask Emarsys support '
                + 'to index a custom field.';
        }
        if (replyCode === ERROR_MULTIPLE_CONTACTS) {
            return `Emarsys found more than one contact for that value (error ${replyCode}${suffix}).`;
        }
        return `Emarsys returned error ${replyCode}${suffix}`;
    },

    // True when every key in the response failed with "no contact found".
    hasNoContactFoundError(body) {

        const errors = lib.collectErrors(body);
        return errors.length > 0 && errors.every(error => {
            const code = Number(error.errorCode !== undefined ? error.errorCode : error.code);
            const message = (error.errorMsg || error.message || '').toString().toLowerCase();
            return code === ERROR_NO_CONTACT_FOUND || message.includes('no contact found');
        });
    },

    /**
     * Flatten data.errors into a uniform list. Emarsys uses three shapes for it: an array of
     * `{ key, errorCode, errorMsg }`, a map of lookup value -> message, and — this is the one
     * getdata uses — a map nested twice, `{ "<lookupValue>": { "<errorCode>": "<message>" } }`.
     * @param {object} body - A Core API response envelope.
     * @returns {Array<{key: string, errorCode?: number, errorMsg?: string}>}
     */
    collectErrors(body) {

        const errors = body && body.data && body.data.errors;
        if (Array.isArray(errors)) {
            return errors.filter(Boolean);
        }
        if (!errors || typeof errors !== 'object') {
            return [];
        }

        return Object.keys(errors).reduce((list, key) => {
            const entry = errors[key];
            if (!entry || typeof entry !== 'object') {
                list.push({ key, errorMsg: entry });
                return list;
            }
            const codes = Object.keys(entry);
            if (codes.length && codes.every(code => /^\d+$/.test(code))) {
                codes.forEach(code => list.push({ key, errorCode: Number(code), errorMsg: entry[code] }));
                return list;
            }
            list.push({ key, ...entry });
            return list;
        }, []);
    },

    /**
     * Fetch the account's contact field definitions, cached. Cached unconditionally (not only for
     * inspector source calls): field definitions change rarely, every FindContacts run needs them
     * to resolve numeric keys into readable names, and the designer fires this in bursts while a
     * dropdown opens.
     * @param {object} context
     * @param {string} [language] - Label language; does not affect the returned string_ids.
     * @returns {Promise<Array<{id: string, name: string, stringId: string, applicationType: string}>>}
     */
    async getFields(context, language = DEFAULT_LANGUAGE) {

        return lib.cached(context, { resource: 'fields', language }, async () => {
            const body = await lib.coreRequest(context, { url: `/field/translate/${encodeURIComponent(language)}` });
            return lib.normalizeFields(body.data);
        });
    },

    normalizeFields(data) {

        const list = Array.isArray(data) ? data : (data && (data.fields || data.result)) || [];
        return list
            .map(field => ({
                id: (field.id !== undefined && field.id !== null) ? field.id.toString() : '',
                name: (field.name || '').toString(),
                stringId: (field.string_id || field.stringId || '').toString(),
                applicationType: (field.application_type || field.applicationType || '').toString()
            }))
            .filter(field => field.id);
    },

    // Readable output key for a field: prefer Emarsys' own string_id, fall back to a slug of the
    // translated label, and finally to the raw id so no value is ever silently dropped.
    fieldOutputKey(field) {

        if (!field) {
            return '';
        }
        if (field.stringId) {
            return field.stringId;
        }
        const slug = field.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        return slug || `field_${field.id}`;
    },

    /**
     * Re-key one getdata record from Emarsys' numeric field ids to readable keys. Non-numeric keys
     * (id, uid) are Emarsys' own and pass through untouched.
     * @param {object} record
     * @param {object} fieldsById - id -> field definition
     * @returns {object}
     */
    mapContactRecord(record, fieldsById) {

        const mapped = {};
        Object.keys(record || {}).forEach(key => {
            if (!/^\d+$/.test(key)) {
                mapped[key] = record[key];
                return;
            }
            const outputKey = lib.fieldOutputKey(fieldsById[key]) || `field_${key}`;
            mapped[outputKey] = record[key];
        });
        return mapped;
    },

    /**
     * Find contact ids by an exact match on one indexed field. The Core API has no free-form
     * search: `?{fieldId}={value}` is an exact match and works on indexed columns only. One page
     * at the maximum page size, per the Find convention.
     * @param {object} context
     * @param {object} options - { fieldId, value }
     * @returns {Promise<string[]>} Contact ids.
     */
    async queryContactIds(context, { fieldId, value }) {

        const body = await lib.coreRequest(context, {
            url: '/contact/query/',
            params: {
                [fieldId]: value,
                return: fieldId,
                limit: QUERY_PAGE_SIZE
            }
        });

        if (lib.hasNoContactFoundError(body)) {
            return [];
        }

        const result = (body.data && body.data.result) || [];
        if (!Array.isArray(result)) {
            return [];
        }

        return result
            .filter(row => row && row.id !== undefined && row.id !== null)
            .map(row => row.id.toString());
    },

    /**
     * Fetch full contact records by internal id. Querying first and then reading by id (rather
     * than reading by email directly) is what makes duplicate emails work — a getdata keyed on
     * email fails with 2010 "More contacts found".
     * @param {object} context
     * @param {object} options - { ids, fieldIds, fieldsById }
     * @returns {Promise<object[]>} Records with readable keys.
     */
    async getContactsByIds(context, { ids, fieldIds, fieldsById }) {

        const records = [];

        for (let start = 0; start < ids.length; start += GETDATA_CHUNK_SIZE) {
            const body = await lib.coreRequest(context, {
                method: 'POST',
                url: '/contact/getdata',
                data: {
                    keyId: 'id',
                    keyValues: ids.slice(start, start + GETDATA_CHUNK_SIZE),
                    fields: fieldIds
                }
            });

            if (lib.hasNoContactFoundError(body)) {
                continue;
            }

            const result = (body.data && body.data.result) || [];
            if (!Array.isArray(result)) {
                continue;
            }
            result.forEach(record => records.push(lib.mapContactRecord(record, fieldsById)));
        }

        return records;
    },

    // id -> field definition, for re-keying getdata records.
    indexFieldsById(fields) {

        return fields.reduce((index, field) => {
            index[field.id] = field;
            return index;
        }, {});
    },

    /**
     * Resolve the "fields to return" input into the numeric ids getdata expects. An empty
     * selection means "every field the account has" — Emarsys returns nothing at all when
     * `fields` is empty, so the default has to be spelled out.
     * @param {string[]|string} selection - Multi-select value, or a comma-separated list.
     * @param {object[]} allFields
     * @returns {number[]|string[]}
     */
    normalizeSelectedFields(selection, allFields) {

        const raw = Array.isArray(selection)
            ? selection
            : (selection || '').toString().split(',');
        const ids = raw
            .map(value => (value === null || value === undefined) ? '' : value.toString().trim())
            .filter(Boolean);

        const chosen = ids.length ? ids : allFields.map(field => field.id);

        // Emarsys documents `fields` as a list of integers; keep anything non-numeric as-is so a
        // string_id typed by hand is still passed through rather than silently dropped.
        return chosen.map(id => (/^\d+$/.test(id) ? Number(id) : id));
    },

    /**
     * Read every Core field of one contact. The webhook triggers use this to get past the webhook
     * node's cap of 20 contact-data key/field pairs.
     * @param {object} context
     * @param {string} contactId
     * @returns {Promise<object|null>} The contact with readable keys, or null when it is gone.
     */
    async enrichContact(context, contactId) {

        const fields = await lib.getFields(context);
        const records = await lib.getContactsByIds(context, {
            ids: [contactId.toString()],
            fieldIds: fields.map(field => Number(field.id)),
            fieldsById: lib.indexFieldsById(fields)
        });
        return records[0] || null;
    },

    /**
     * The contact item schema as it exists in THIS account: the caller's always-present base keys
     * plus one leaf per configured field. Used to build the dynamic output port options so the
     * variable picker offers the customer's own custom fields, not just the system ones.
     * @param {object} context
     * @param {object} baseProperties - The component's ITEM_SCHEMA.properties.
     * @param {string[]} [selection] - The "fields to return" selection, if the user narrowed it.
     * @returns {Promise<object>} JSON Schema property map.
     */
    async contactSchemaProperties(context, baseProperties, selection) {

        const fields = await lib.getFields(context);
        const properties = { ...baseProperties };

        // Honour a narrowed selection: advertising fields the run will not fetch would give the
        // designer variables that resolve to undefined.
        const selected = Array.isArray(selection) ? selection.filter(Boolean) : [];
        const selectedIds = selected.length ? new Set(selected.map(id => id.toString())) : null;

        fields.forEach(field => {
            if (selectedIds && !selectedIds.has(field.id)) {
                return;
            }
            const key = lib.fieldOutputKey(field);
            if (!key || properties[key]) {
                return;
            }
            // No example: the value of a customer-defined field is unknowable from here, and a
            // made-up one would be more misleading in the picker preview than none.
            properties[key] = { type: 'string', title: field.name || key };
        });

        return properties;
    },

    /**
     * Read-only Webhook URL input. Emarsys has no API to register a webhook — the only push
     * mechanism is the Automation Center Webhook node, which the customer configures by hand — so
     * the triggers surface the URL for the user to paste into a webhook node preset.
     * @param {object} context
     * @param {string} tooltip
     * @returns {object} An inspector definition.
     */
    webhookUrlInspector(context, tooltip) {

        return {
            inputs: {
                webhookUrl: {
                    type: 'text',
                    label: 'Webhook URL',
                    index: 0,
                    readonly: true,
                    defaultValue: context.getWebhookUrl(),
                    tooltip
                }
            }
        };
    },

    /**
     * Normalize one webhook node delivery. The body is flat JSON: the key/field pairs the customer
     * configured in the preset, plus Emarsys' own deduplication_id / ems_program_id / event_time /
     * event_data. Split those apart so the contact keys stay addressable under `contact`.
     * @param {object} event
     * @returns {object}
     */
    normalizeWebhookEvent(event) {

        const body = event || {};
        const meta = ['deduplication_id', 'ems_program_id', 'event_time', 'event_data'];
        const contact = {};
        Object.keys(body).forEach(key => {
            if (!meta.includes(key)) {
                contact[key] = body[key];
            }
        });

        return {
            contactId: lib.pickString(body, ['contact_id', 'contactId', 'id']),
            email: lib.pickString(body, ['email', 'email_address']),
            deduplicationId: lib.pickString(body, ['deduplication_id']),
            programId: lib.pickString(body, ['ems_program_id']),
            eventTime: lib.pickString(body, ['event_time']),
            eventData: body.event_data || {},
            contact
        };
    },

    pickString(source, keys) {

        for (const key of keys) {
            const value = source[key];
            if (value !== undefined && value !== null && value !== '') {
                return value.toString();
            }
        }
        return '';
    },

    /**
     * Emit the events of one webhook node delivery, deduplicated per component on Emarsys'
     * deduplication_id. Shared by both webhook triggers: they differ only in what they document
     * and in the extra fields they derive, not in how delivery works.
     *
     * Deliberately NOT answered before the emits: a webhook node retries a non-2xx with an
     * exponential backoff, so letting a failure propagate (without marking the delivery seen) is
     * what gets the event redelivered rather than lost.
     * @param {object} context
     * @param {object} options - { decorate } — async, may add fields to the emitted message.
     * @returns {Promise<*>} The webhook response.
     */
    async emitWebhookEvents(context, { decorate } = {}) {

        const payload = context.messages.webhook.content.data;
        const events = Array.isArray(payload) ? payload : [payload];

        for (const event of events) {
            const normalized = lib.normalizeWebhookEvent(event);
            const cacheKey = normalized.deduplicationId
                ? `emarsys-webhook-${context.componentId}-${normalized.deduplicationId}`
                : null;

            if (cacheKey && await context.staticCache.get(cacheKey)) {
                await context.log({ step: 'Skipped duplicate delivery', deduplicationId: normalized.deduplicationId });
                continue;
            }

            // Decorating can mean two Core API calls (see enrichContact), each with a 60s timeout,
            // so it stays outside the lock — no sane lock TTL covers it.
            const message = decorate ? await decorate(normalized, event) : normalized;

            let lock;
            try {
                // Locked per delivery, not per component, so unrelated contacts in the same batch
                // do not serialise behind each other.
                lock = await context.lock(cacheKey || context.componentId, {
                    ttl: 1000 * 10,
                    retryDelay: 500,
                    maxRetryCount: 3
                });

                // Re-check: a concurrent delivery of the same contact may have claimed it while
                // this one was decorating.
                if (cacheKey && await context.staticCache.get(cacheKey)) {
                    continue;
                }

                await context.sendJson(message, 'out');

                // Mark only once the message is out. Marking first would make a failed emit
                // permanent: the entry outlives Emarsys' whole retry schedule, so every
                // redelivery would be dropped as a duplicate.
                if (cacheKey) {
                    await context.staticCache.set(cacheKey, 1, WEBHOOK_DEDUPE_TTL);
                }
            } finally {
                await (lock && lock.unlock());
            }
        }

        return context.response();
    },

    /**
     * Flow Test Mode has nothing to emit for these triggers: the events exist only as an
     * Automation Center webhook node delivery and Emarsys exposes no endpoint for past
     * deliveries, so there is no real example to fetch — and fabricating one would make the test
     * pass while testing nothing.
     * @param {object} context
     * @param {string} what - What the trigger emits, e.g. 'New customer events'.
     * @returns {Error}
     */
    webhookTestError(context, what) {

        return new context.CancelError(
            `${what} arrive only as a delivery from an Emarsys Automation Center webhook node, and Emarsys has no `
            + 'API to read a past delivery. Start the flow, paste the Webhook URL into a webhook node preset, and '
            + 'let the program run (or use the preset\'s own test delivery) to see a real event.');
    },

    /**
     * Cache the result of an expensive read. The designer fires inspector source calls in
     * concurrent bursts, so the lock matters as much as the cache: the first caller populates the
     * entry and the rest of the burst read it instead of hitting the API.
     * @param {object} context
     * @param {object} keyParts - Everything that shapes the result; hashed into the cache key.
     * @param {Function} fetch
     * @returns {Promise<*>}
     */
    async cached(context, keyParts, fetch) {

        // Keyed on the client id, not the token: the JWT is reissued every hour, which would
        // orphan every entry on each refresh, and the client id isolates accounts just as well.
        const key = 'emarsys-' + crypto.createHash('sha256')
            .update(JSON.stringify({ ...keyParts, clientId: (context.auth && context.auth.clientId) || '' }))
            .digest('hex');
        let lock;

        try {
            lock = await context.lock(key);
            const cached = await context.staticCache.get(key);
            if (cached) {
                return cached;
            }
            const value = await fetch();
            const ttl = (context.config && context.config.listCacheTTL) || DEFAULT_LIST_CACHE_TTL;
            await context.staticCache.set(key, value, ttl);
            return value;
        } finally {
            await (lock && lock.unlock());
        }
    },

    async sendArrayOutput({ context, outputPortName = 'out', outputType = 'array', records = [] }) {

        if (outputType === 'first') {
            if (records.length === 0) {
                throw new context.CancelError('No records available for first output type');
            }
            await context.sendJson({ ...records[0], index: 0, count: records.length }, outputPortName);
        } else if (outputType === 'object') {
            for (let index = 0; index < records.length; index++) {
                await context.sendJson({ ...records[index], index, count: records.length }, outputPortName);
            }
        } else if (outputType === 'array') {
            await context.sendJson({ result: records, count: records.length }, outputPortName);
        } else if (outputType === 'file') {
            const csvString = toCsv(records);
            const buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${(context.config && context.config.outputFilePrefix) || DEFAULT_PREFIX}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    getOutputPortOptions(context, outputType, itemSchema, { label, value }) {

        if (outputType === 'object' || outputType === 'first') {
            const options = Object.keys(itemSchema).reduce((res, field) => {
                const schema = itemSchema[field];
                const { title: fieldLabel, ...schemaWithoutTitle } = schema;
                res.push({ label: fieldLabel, value: field, schema: schemaWithoutTitle });
                return res;
            }, [
                { label: 'Current Item Index', value: 'index', schema: { type: 'integer' } },
                { label: 'Items Count', value: 'count', schema: { type: 'integer' } }
            ]);
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
            }, {
                label: 'Items Count',
                value: 'count',
                schema: { type: 'integer' }
            }], 'out');
        }

        if (outputType === 'file') {
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};

function toCsv(array) {
    if (!array || array.length === 0) {
        return '';
    }
    const headers = Object.keys(array[0]);
    return [
        headers.join(','),
        ...array.map(item => {
            return Object.values(item).map(property => {
                if (typeof property === 'object') {
                    return JSON.stringify(property);
                }
                return property;
            }).join(',');
        })
    ].join('\n');
}

module.exports = lib;

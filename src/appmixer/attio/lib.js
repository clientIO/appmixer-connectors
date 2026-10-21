'use strict';

const crypto = require('crypto');
const pathModule = require('path');

const API_BASE_URL = 'https://api.attio.com';
const DEFAULT_PREFIX = 'attio-objects-export';

// Maximum number of items a Find/List component returns. Attio's query endpoints return up
// to 500 items per page by default; notes are capped at 50 per page, so they are paged
// internally up to this limit.
const MAX_ITEMS = 500;

/**
 * Turn an Attio error response into a readable message. Attio errors look like
 * { status_code, type, code, message }.
 */
function toAttioError(err) {
    const data = err && err.response && err.response.data;
    if (data && typeof data === 'object' && data.message) {
        const status = data.status_code || err.response.status;
        const error = new Error(`Attio API error ${status}${data.code ? ' (' + data.code + ')' : ''}: ${data.message}`);
        error.response = err.response;
        return error;
    }
    return err;
}

/**
 * Authorized request against the Attio REST API.
 * @param {Object} context
 * @param {Object} options { method, path, params, data, headers }
 * @returns {Promise<Object>} response body
 */
async function apiRequest(context, { method = 'GET', path, params, data, headers } = {}) {
    const request = {
        method,
        url: `${API_BASE_URL}${path}`,
        // Multipart uploads pass their own content type (with the boundary) in `headers`.
        headers: headers
            ? { Authorization: `Bearer ${context.auth.apiKey}`, ...headers }
            : { Authorization: `Bearer ${context.auth.apiKey}`, 'Content-Type': 'application/json' }
    };
    if (params) request.params = params;
    if (data !== undefined) request.data = data;
    try {
        const response = await context.httpRequest(request);
        return response.data;
    } catch (err) {
        throw toAttioError(err);
    }
}

function getCacheKey(obj) {
    return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

/**
 * GET with a short-lived cache. Used by components that back inspector dropdowns: the
 * designer fires these in bursts, so concurrent callers wait on the lock and then read
 * the cached value instead of hitting the API again.
 */
async function apiGetCached(context, path, params) {
    let lock;
    try {
        const key = getCacheKey({ connector: 'attio', path, params, token: context.auth.apiKey });
        lock = await context.lock(key);
        const cached = await context.staticCache.get(key);
        if (cached) return cached;
        const data = await apiRequest(context, { method: 'GET', path, params });
        await context.staticCache.set(key, data, context.config.listCacheTTL || (2 * 60 * 1000));
        return data;
    } finally {
        lock && lock.unlock();
    }
}

/**
 * Parse a JSON object input (a textarea in the inspector or an object passed from a
 * previous component).
 */
function parseJsonObject(context, value, label) {
    if (value === undefined || value === null || value === '') return undefined;
    let parsed = value;
    if (typeof value === 'string') {
        try {
            parsed = JSON.parse(value);
        } catch (e) {
            throw new context.CancelError(`${label} must be a valid JSON object.`);
        }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new context.CancelError(`${label} must be a JSON object.`);
    }
    return parsed;
}

/**
 * Split a comma separated list ("a@b.com, c@d.com") into trimmed, non-empty strings.
 */
function splitList(value) {
    if (value === undefined || value === null || value === '') return [];
    if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
    return String(value).split(',').map(v => v.trim()).filter(Boolean);
}

/**
 * The plain value of one Attio attribute value object, by attribute type.
 */
function simplifyValue(value) {
    if (!value || typeof value !== 'object') return value;
    switch (value.attribute_type) {
        case 'personal-name':
            return value.full_name;
        case 'email-address':
            return value.email_address;
        case 'domain':
            return value.domain;
        case 'phone-number':
            return value.original_phone_number || value.phone_number || value.normalized_phone_number;
        case 'currency':
            return value.currency_value;
        case 'select':
            return value.option ? value.option.title : null;
        case 'status':
            return value.status ? value.status.title : null;
        case 'record-reference':
            return value.target_record_id;
        case 'actor-reference':
            return value.referenced_actor_id;
        case 'interaction':
            return value.interacted_at;
        case 'location': {
            const parts = [
                value.line_1, value.line_2, value.locality, value.region, value.postcode, value.country_code
            ];
            return parts.filter(Boolean).join(', ');
        }
        default:
            return value.value !== undefined ? value.value : null;
    }
}

/**
 * Attio returns every attribute as an array of value objects (with history metadata).
 * Flatten that to { slug: plainValue } — a single value becomes a scalar, several values
 * an array, no value null. The raw shape is kept in `rawValues`.
 */
function simplifyValues(values = {}) {
    const result = {};
    for (const [slug, list] of Object.entries(values || {})) {
        const items = (Array.isArray(list) ? list : [list])
            .filter(v => !v || v.active_until === undefined || v.active_until === null)
            .map(simplifyValue);
        result[slug] = items.length === 0 ? null : (items.length === 1 ? items[0] : items);
    }
    return result;
}

/**
 * Values of a person record from the inputs of Create Person / Create or Update Person.
 */
function buildPersonValues(context, input) {
    const values = { ...(parseJsonObject(context, input.additionalValues, 'Additional Values') || {}) };
    const { firstName, lastName, jobTitle, description, companyId } = input;
    if (firstName || lastName) {
        values.name = {
            first_name: firstName || '',
            last_name: lastName || '',
            full_name: [firstName, lastName].filter(Boolean).join(' ')
        };
    }
    const emails = splitList(input.emailAddresses);
    if (emails.length) values.email_addresses = emails;
    const phones = splitList(input.phoneNumbers);
    if (phones.length) values.phone_numbers = phones;
    if (jobTitle) values.job_title = jobTitle;
    if (description) values.description = description;
    if (companyId) values.company = [{ target_object: 'companies', target_record_id: companyId }];
    return values;
}

/**
 * Values of a company record from the inputs of Create Company / Create or Update Company.
 */
function buildCompanyValues(context, input) {
    const values = { ...(parseJsonObject(context, input.additionalValues, 'Additional Values') || {}) };
    if (input.name) values.name = input.name;
    const domains = splitList(input.domains);
    if (domains.length) values.domains = domains;
    if (input.description) values.description = input.description;
    return values;
}

function mapRecord(record = {}) {
    const id = record.id || {};
    return {
        id: id.record_id,
        objectId: id.object_id,
        workspaceId: id.workspace_id,
        createdAt: record.created_at,
        webUrl: record.web_url,
        values: simplifyValues(record.values),
        rawValues: record.values || {}
    };
}

function mapEntry(entry = {}) {
    const id = entry.id || {};
    return {
        id: id.entry_id,
        listId: id.list_id,
        workspaceId: id.workspace_id,
        parentRecordId: entry.parent_record_id,
        parentObject: entry.parent_object,
        createdAt: entry.created_at,
        entryValues: simplifyValues(entry.entry_values),
        rawEntryValues: entry.entry_values || {}
    };
}

function mapNote(note = {}) {
    const id = note.id || {};
    return {
        id: id.note_id,
        workspaceId: id.workspace_id,
        parentObject: note.parent_object,
        parentRecordId: note.parent_record_id,
        title: note.title,
        contentPlaintext: note.content_plaintext,
        contentMarkdown: note.content_markdown,
        meetingId: note.meeting_id === undefined ? null : note.meeting_id,
        createdByActorType: note.created_by_actor ? note.created_by_actor.type : null,
        createdByActorId: note.created_by_actor ? note.created_by_actor.id : null,
        createdAt: note.created_at
    };
}

function mapTask(task = {}) {
    const id = task.id || {};
    return {
        id: id.task_id,
        workspaceId: id.workspace_id,
        content: task.content_plaintext,
        deadlineAt: task.deadline_at,
        isCompleted: task.is_completed,
        completedAt: task.completed_at,
        linkedRecords: (task.linked_records || []).map(r => ({
            targetObjectId: r.target_object_id,
            targetRecordId: r.target_record_id
        })),
        assignees: (task.assignees || []).map(a => ({
            actorType: a.referenced_actor_type,
            actorId: a.referenced_actor_id
        })),
        createdByActorType: task.created_by_actor ? task.created_by_actor.type : null,
        createdByActorId: task.created_by_actor ? task.created_by_actor.id : null,
        createdAt: task.created_at
    };
}

function mapComment(comment = {}) {
    const id = comment.id || {};
    return {
        id: id.comment_id,
        workspaceId: id.workspace_id,
        threadId: comment.thread_id,
        content: comment.content_plaintext,
        recordId: comment.record ? comment.record.record_id : null,
        objectId: comment.record ? comment.record.object_id : null,
        entryId: comment.entry ? comment.entry.entry_id : null,
        listId: comment.entry ? comment.entry.list_id : null,
        authorType: comment.author ? comment.author.type : null,
        authorId: comment.author ? comment.author.id : null,
        resolvedAt: comment.resolved_at === undefined ? null : comment.resolved_at,
        createdAt: comment.created_at
    };
}

function mapObject(object = {}) {
    const id = object.id || {};
    return {
        id: id.object_id,
        apiSlug: object.api_slug,
        singularNoun: object.singular_noun,
        pluralNoun: object.plural_noun,
        createdAt: object.created_at
    };
}

function mapList(list = {}) {
    const id = list.id || {};
    return {
        id: id.list_id,
        apiSlug: list.api_slug,
        name: list.name,
        parentObject: Array.isArray(list.parent_object) ? list.parent_object.join(',') : list.parent_object,
        workspaceAccess: list.workspace_access,
        createdAt: list.created_at
    };
}

function mapAttribute(attribute = {}) {
    const id = attribute.id || {};
    return {
        id: id.attribute_id,
        apiSlug: attribute.api_slug,
        title: attribute.title,
        description: attribute.description,
        type: attribute.type,
        isSystemAttribute: attribute.is_system_attribute,
        isWritable: attribute.is_writable,
        isRequired: attribute.is_required,
        isUnique: attribute.is_unique,
        isMultiselect: attribute.is_multiselect,
        isArchived: attribute.is_archived
    };
}

function mapMember(member = {}) {
    const id = member.id || {};
    return {
        id: id.workspace_member_id,
        firstName: member.first_name,
        lastName: member.last_name,
        emailAddress: member.email_address,
        accessLevel: member.access_level,
        avatarUrl: member.avatar_url,
        createdAt: member.created_at
    };
}

function mapFile(file = {}) {
    const id = file.id || {};
    return {
        id: id.file_id,
        workspaceId: id.workspace_id,
        objectId: file.object_id,
        objectSlug: file.object_slug,
        recordId: file.record_id,
        name: file.name,
        contentType: file.content_type,
        contentSize: file.content_size,
        parentFolderId: file.parent_folder_id,
        storageProvider: file.storage_provider,
        createdAt: file.created_at
    };
}

/**
 * The workspace and token details returned by GET /v2/self.
 */
function mapWorkspace(self = {}) {
    return {
        workspaceId: self.workspace_id,
        workspaceName: self.workspace_name,
        workspaceSlug: self.workspace_slug,
        workspaceLogoUrl: self.workspace_logo_url,
        tokenLevel: self.token_level,
        scopes: splitList((self.scope || '').split(' ')),
        authorizedByWorkspaceMemberId: self.authorized_by_workspace_member_id
    };
}

/**
 * Query records of an object (POST /v2/objects/{object}/records/query), one page of up to
 * MAX_ITEMS records.
 */
async function queryRecords(context, object, { filter, sorts, limit = MAX_ITEMS } = {}) {
    const body = { limit };
    if (filter && Object.keys(filter).length) body.filter = filter;
    if (sorts && sorts.length) body.sorts = sorts;
    const data = await apiRequest(context, {
        method: 'POST',
        path: `/v2/objects/${encodeURIComponent(object)}/records/query`,
        data: body
    });
    return (data.data || []).map(mapRecord);
}

async function getRecord(context, object, recordId) {
    const data = await apiRequest(context, {
        path: `/v2/objects/${encodeURIComponent(object)}/records/${encodeURIComponent(recordId)}`
    });
    return mapRecord(data.data);
}

async function createRecord(context, object, values) {
    const data = await apiRequest(context, {
        method: 'POST',
        path: `/v2/objects/${encodeURIComponent(object)}/records`,
        data: { data: { values } }
    });
    return mapRecord(data.data);
}

async function upsertRecord(context, object, matchingAttribute, values) {
    const data = await apiRequest(context, {
        method: 'PUT',
        path: `/v2/objects/${encodeURIComponent(object)}/records`,
        params: { matching_attribute: matchingAttribute },
        data: { data: { values } }
    });
    return mapRecord(data.data);
}

/**
 * Resolve an object slug (or UUID) to the object's UUID. Webhook filters compare against
 * the ids in the event payload, so they need the UUID.
 */
async function resolveObjectId(context, object) {
    const data = await apiRequest(context, { path: `/v2/objects/${encodeURIComponent(object)}` });
    return data.data.id.object_id;
}

async function resolveListId(context, list) {
    const data = await apiRequest(context, { path: `/v2/lists/${encodeURIComponent(list)}` });
    return data.data.id.list_id;
}

/**
 * Register a webhook with one subscription. Returns the created webhook (id + status).
 */
async function createWebhook(context, eventType, filter) {
    const data = await apiRequest(context, {
        method: 'POST',
        path: '/v2/webhooks',
        data: {
            data: {
                target_url: context.getWebhookUrl(),
                subscriptions: [{ event_type: eventType, filter: filter || null }]
            }
        }
    });
    return data.data;
}

async function deleteWebhook(context, webhookId) {
    if (!webhookId) return;
    try {
        await apiRequest(context, { method: 'DELETE', path: `/v2/webhooks/${encodeURIComponent(webhookId)}` });
    } catch (err) {
        // The webhook may already be gone (deleted in Attio, or the token was revoked).
        await context.log({ step: 'deleteWebhook', webhookId, error: err.message });
    }
}

function equalsFilter(field, value) {
    return { $and: [{ field, operator: 'equals', value }] };
}

/**
 * Start a webhook trigger: register one Attio webhook for `eventType` and remember its id.
 */
async function startWebhookTrigger(context, eventType, filter) {
    const webhook = await createWebhook(context, eventType, filter);
    return context.saveState({ webhookId: webhook.id.webhook_id });
}

async function stopWebhookTrigger(context) {
    const { webhookId } = await context.loadState();
    await deleteWebhook(context, webhookId);
}

/**
 * The events of an incoming delivery that belong to this trigger and were not seen yet.
 *
 * Attio delivers at-least-once and repeats the same `Idempotency-Key` header for retries,
 * so a delivery seen in the last 10 minutes is skipped. Deliveries for a webhook other than
 * the one this trigger registered are ignored. Attio signs the raw body (Attio-Signature,
 * HMAC SHA-256), but components only receive the parsed body, so the signature cannot be
 * re-computed byte-exactly here; events are therefore never trusted as data — every
 * trigger re-fetches the entity through the API with the user's own token.
 */
async function getWebhookEvents(context, eventType) {
    const { data = {}, headers = {} } = context.messages.webhook.content;
    const { webhookId } = await context.loadState();
    if (webhookId && data.webhook_id && data.webhook_id !== webhookId) {
        return [];
    }

    const idempotencyKey = headers['idempotency-key'] || headers['Idempotency-Key'];
    if (idempotencyKey) {
        const cacheKey = `attio-webhook-${context.componentId}-${idempotencyKey}`;
        if (await context.staticCache.get(cacheKey)) return [];
        await context.staticCache.set(cacheKey, true, 10 * 60 * 1000);
    }

    return (data.events || []).filter(event => event && event.event_type === eventType);
}

/**
 * The actor of a webhook event ({ type, id }).
 */
function actorOfEvent(event = {}) {
    const actor = event.actor || {};
    return { type: actor.type || null, id: actor.id || null };
}

/**
 * The actor that created a record or entry, read from its `created_by` attribute. Used by
 * the triggers' test() so the sample has the same shape as a real event.
 */
function actorFromValues(rawValues = {}) {
    const createdBy = (rawValues.created_by || [])[0] || {};
    return { type: createdBy.referenced_actor_type || null, id: createdBy.referenced_actor_id || null };
}

function isNotFound(err) {
    return !!(err && err.response && err.response.status === 404);
}

/**
 * Records of an object, newest first (used by the record triggers' test()).
 */
async function latestRecords(context, object, limit = 1) {
    return queryRecords(context, object, { sorts: [{ attribute: 'created_at', direction: 'desc' }], limit });
}

/**
 * Entries of a list, newest first (used by the list entry triggers' test()).
 */
async function latestEntries(context, list, limit = 1) {
    const path = '/v2/lists/' + encodeURIComponent(list) + '/entries/query';
    const data = await apiRequest(context, {
        method: 'POST',
        path,
        data: { limit, sorts: [{ attribute: 'created_at', direction: 'desc' }] }
    });
    return (data.data || []).map(mapEntry);
}

async function getEntry(context, list, entryId) {
    const data = await apiRequest(context, {
        path: '/v2/lists/' + encodeURIComponent(list) + '/entries/' + encodeURIComponent(entryId)
    });
    return mapEntry(data.data);
}

async function sendArrayOutput({ context, outputPortName = 'out', outputType = 'array', records = [] }) {
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
        const fileName = `${context.config.outputFilePrefix || DEFAULT_PREFIX}-${componentName}.csv`;
        const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
        await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
        await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
    } else {
        throw new context.CancelError('Unsupported outputType ' + outputType);
    }
}

function getOutputPortOptions(context, outputType, itemSchema, { label, value }) {
    if (outputType === 'object' || outputType === 'first') {
        const options = Object.keys(itemSchema)
            .reduce((res, field) => {
                const schema = itemSchema[field];
                const { title, ...schemaWithoutTitle } = schema;
                res.push({ label: title, value: field, schema: schemaWithoutTitle });
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

const toCsv = (array) => {
    // An empty result set is ordinary (new workspace, filter matches nothing).
    if (!array.length) {
        return '';
    }
    const headers = Object.keys(array[0]);
    return [
        headers.join(','),
        ...array.map(items => {
            return Object.values(items).map(property => {
                if (property && typeof property === 'object') {
                    return JSON.stringify(property);
                }
                return property;
            }).join(',');
        })
    ].join('\n');
};

module.exports = {
    API_BASE_URL,
    MAX_ITEMS,
    apiRequest,
    apiGetCached,
    parseJsonObject,
    splitList,
    simplifyValue,
    simplifyValues,
    buildPersonValues,
    buildCompanyValues,
    mapRecord,
    mapEntry,
    mapNote,
    mapTask,
    mapComment,
    mapObject,
    mapList,
    mapAttribute,
    mapMember,
    mapFile,
    mapWorkspace,
    queryRecords,
    getRecord,
    createRecord,
    upsertRecord,
    resolveObjectId,
    resolveListId,
    createWebhook,
    deleteWebhook,
    equalsFilter,
    startWebhookTrigger,
    stopWebhookTrigger,
    getWebhookEvents,
    actorOfEvent,
    actorFromValues,
    isNotFound,
    latestRecords,
    latestEntries,
    getEntry,
    sendArrayOutput,
    getOutputPortOptions
};

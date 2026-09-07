'use strict';

const pathModule = require('path');

const BASE_URL = 'https://bsky.social';

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

/**
 * Returns a valid accessJwt for the authenticated user.
 * Bluesky access tokens are short-lived; we refresh automatically.
 */
async function getAccessToken(context) {
    if (context.auth.refreshJwt) {
        try {
            const resp = await context.httpRequest({
                method: 'POST',
                url: `${BASE_URL}/xrpc/com.atproto.server.refreshSession`,
                headers: {
                    'Authorization': `Bearer ${context.auth.refreshJwt}`,
                    'Content-Type': 'application/json'
                }
            });
            return resp.data.accessJwt;
        } catch (e) {
            // Fall through to createSession
        }
    }
    const resp = await context.httpRequest({
        method: 'POST',
        url: `${BASE_URL}/xrpc/com.atproto.server.createSession`,
        data: {
            identifier: context.auth.handle,
            password: context.auth.appPassword
        },
        headers: { 'Content-Type': 'application/json' }
    });
    return resp.data.accessJwt;
}

/**
 * Make an authenticated XRPC request.
 * Automatically obtains a fresh access token on each call.
 */
async function xrpc(context, { method = 'GET', nsid, params, data, extraHeaders = {} }) {
    const token = await getAccessToken(context);
    const url = `${BASE_URL}/xrpc/${nsid}`;

    const response = await context.httpRequest({
        method,
        url,
        params: method === 'GET' ? params : undefined,
        data: method !== 'GET' ? data : undefined,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...extraHeaders
        }
    });

    return response.data;
}

// ---------------------------------------------------------------------------
// Rich-text facet auto-derivation
// ---------------------------------------------------------------------------

/**
 * Parse plain text and derive AT Protocol `facets` for:
 *  - @mention  → app.bsky.richtext.facet#mention
 *  - URL link  → app.bsky.richtext.facet#link
 *
 * Byte offsets are required (UTF-8).
 */
async function buildFacets(context, text) {
    const encoder = new TextEncoder();
    const facets = [];

    // Detect URLs
    const urlRegex = /https?:\/\/[^\s\])"'>]+/g;
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
        const start = encoder.encode(text.slice(0, match.index)).length;
        const end = start + encoder.encode(match[0]).length;
        facets.push({
            index: { byteStart: start, byteEnd: end },
            features: [{
                $type: 'app.bsky.richtext.facet#link',
                uri: match[0]
            }]
        });
    }

    // Detect @mentions — resolve handle → DID
    // eslint-disable-next-line max-len
    const mentionRegex = /@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+)/g;
    while ((match = mentionRegex.exec(text)) !== null) {
        const handle = match[1];
        let did;
        try {
            const token = await getAccessToken(context);
            const res = await context.httpRequest({
                method: 'GET',
                url: `${BASE_URL}/xrpc/com.atproto.identity.resolveHandle`,
                params: { handle },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            did = res.data.did;
        } catch (e) {
            // Skip unresolvable handles
            continue;
        }
        const start = encoder.encode(text.slice(0, match.index)).length;
        const end = start + encoder.encode(match[0]).length;
        facets.push({
            index: { byteStart: start, byteEnd: end },
            features: [{
                $type: 'app.bsky.richtext.facet#mention',
                did
            }]
        });
    }

    return facets.length ? facets : undefined;
}

// ---------------------------------------------------------------------------
// outputType helpers (standard Appmixer pattern)
// ---------------------------------------------------------------------------

const DEFAULT_PREFIX = 'bluesky-export';

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
        const options = Object.keys(itemSchema).reduce((res, field) => {
            const schema = itemSchema[field];
            const { title: label, ...schemaWithoutTitle } = schema;
            res.push({ label, value: field, schema: schemaWithoutTitle });
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
            value: 'result',
            schema: { type: 'array', items: { type: 'object', properties: itemSchema } }
        }], 'out');
    }
    if (outputType === 'file') {
        return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
    }
}

function toCsv(array) {
    if (!array.length) return '';
    const headers = Object.keys(array[0]);
    return [
        headers.join(','),
        ...array.map(item =>
            Object.values(item).map(v =>
                typeof v === 'object' ? JSON.stringify(v) : v
            ).join(',')
        )
    ].join('\n');
}

// ---------------------------------------------------------------------------
// Notification trigger helpers (shared by tick() and test())
// ---------------------------------------------------------------------------

/**
 * Fetch all notifications for the authenticated user, following pagination.
 * Notifications are returned newest-first by the API.
 * Shared by every notification trigger's tick().
 */
async function listAllNotifications(context) {
    let allNotifications = [];
    let cursor;
    do {
        const response = await xrpc(context, {
            method: 'GET',
            nsid: 'app.bsky.notification.listNotifications',
            params: Object.assign({ limit: 100 }, cursor ? { cursor } : {})
        });
        const batch = response.notifications || [];
        allNotifications = allNotifications.concat(batch);
        cursor = response.cursor;
        if (!cursor || batch.length === 0) break;
    } while (cursor);
    return allNotifications;
}

/**
 * Fetch the newest notification matching `reason` (e.g. 'follow', 'mention',
 * 'reply'). Used by test() to surface a representative item WITHOUT the
 * dedup baseline that suppresses first-run output in tick(). The API returns
 * notifications newest-first, so the first match is the most recent one.
 */
async function fetchLatestNotification(context, reason) {
    let cursor;
    do {
        const response = await xrpc(context, {
            method: 'GET',
            nsid: 'app.bsky.notification.listNotifications',
            params: Object.assign({ limit: 100 }, cursor ? { cursor } : {})
        });
        const batch = response.notifications || [];
        const match = batch.find(n => n.reason === reason);
        if (match) return match;
        cursor = response.cursor;
        if (!cursor || batch.length === 0) break;
    } while (cursor);
    return null;
}

// ---------------------------------------------------------------------------
// Trigger dedup helpers
// ---------------------------------------------------------------------------

/**
 * Given a Set of known IDs and a new array of items, return:
 *  - diff: items not in known set
 *  - actual: all current IDs
 */
function getNewItems(known, items = [], idField = 'uri') {
    const actual = items.map(i => i[idField]);
    const diff = known ? items.filter(i => !known.has(i[idField])) : [];
    return { diff, actual };
}

module.exports = {
    BASE_URL,
    getAccessToken,
    xrpc,
    buildFacets,
    sendArrayOutput,
    getOutputPortOptions,
    getNewItems,
    listAllNotifications,
    fetchLatestNotification
};

'use strict';

const GOOGLE_DOCS_MIME_TYPE = 'application/vnd.google-apps.document';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const FOLDER_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const BATCH_SIZE = 100; // Google Drive batch API limit

/**
 * Builds the query string for finding subfolders of a given parent.
 * @param {string} parentId - Parent folder ID
 * @returns {string} URL-encoded query string
 */
function buildSubfolderQuery(parentId) {

    const q = `'${parentId}' in parents and mimeType='${FOLDER_MIME_TYPE}' and trashed=false`;
    return `q=${encodeURIComponent(q)}&fields=${encodeURIComponent('files(id)')}&pageSize=1000`;
}

/**
 * Builds multipart/mixed body for Google Drive batch API.
 * @param {string[]} folderIds - Array of folder IDs to query
 * @param {string} boundary - Multipart boundary string
 * @returns {string} Multipart request body
 */
function buildBatchRequestBody(folderIds, boundary) {

    const parts = folderIds.map((folderId, index) => {
        const queryString = buildSubfolderQuery(folderId);
        return [
            `--${boundary}`,
            'Content-Type: application/http',
            `Content-ID: <${index}>`,
            '',
            `GET /drive/v3/files?${queryString}`,
            '',
            ''
        ].join('\r\n');
    });

    return parts.join('') + `--${boundary}--`;
}

/**
 * Parses multipart/mixed response from Google Drive batch API.
 * @param {string} responseBody - Raw response body
 * @param {string} boundary - Multipart boundary string
 * @returns {Object[]} Array of parsed JSON responses
 */
function parseBatchResponse(responseBody, boundary) {

    const results = [];
    const parts = responseBody.split(`--${boundary}`);

    for (const part of parts) {
        if (part.trim() === '' || part.trim() === '--') continue;

        // Find the JSON body - it's after the HTTP headers (double newline)
        const jsonMatch = part.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                results.push(JSON.parse(jsonMatch[0]));
            } catch (e) {
                // Skip malformed responses
            }
        }
    }

    return results;
}

/**
 * Executes a batch request to Google Drive API.
 * @param {Object} context - Appmixer context
 * @param {string[]} folderIds - Array of folder IDs to query for subfolders
 * @returns {Promise<Object[]>} Array of response objects with files arrays
 */
async function executeBatchRequest(context, folderIds) {

    const boundary = `batch_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const body = buildBatchRequestBody(folderIds, boundary);

    const response = await context.httpRequest({
        method: 'POST',
        url: 'https://www.googleapis.com/batch/drive/v3',
        headers: {
            'Authorization': `Bearer ${context.auth.accessToken}`,
            'Content-Type': `multipart/mixed; boundary=${boundary}`
        },
        data: body
    });

    // Extract boundary from response content-type
    const contentType = response.headers['content-type'] || '';
    const responseBoundary = contentType.match(/boundary=([^;]+)/)?.[1] || boundary;

    return parseBatchResponse(response.data, responseBoundary);
}

/**
 * Fetches all subfolder IDs using Google Drive batch API.
 * @param {Object} context - Appmixer context
 * @param {string} folderId - Parent folder ID
 * @returns {Promise<string[]>} Array of all subfolder IDs
 */
async function getSubfolderIds(context, folderId) {

    const allFolderIds = [];
    let foldersToProcess = [folderId];

    while (foldersToProcess.length > 0) {
        const batch = foldersToProcess.splice(0, BATCH_SIZE);
        const responses = await executeBatchRequest(context, batch);

        for (const response of responses) {
            const files = response.files || [];
            for (const folder of files) {
                allFolderIds.push(folder.id);
                foldersToProcess.push(folder.id);
            }
        }
    }

    return allFolderIds;
}

/**
 * Gets the list of folder IDs to monitor, with caching for recursive mode.
 * @param {Object} context - Appmixer context
 * @param {string} folderId - Root folder ID
 * @param {boolean} recursive - Whether to include subfolders
 * @returns {Promise<string[]>} Array of folder IDs to monitor
 */
async function getMonitoredFolderIds(context, folderId, recursive, { skipCache = false } = {}) {

    if (!folderId) {
        return [];
    }

    if (!recursive) {
        return [folderId];
    }

    const cacheKey = `googledocs_subfolders_${folderId}`;

    // Flow Test Mode passes skipCache so test() stays read-only (no staticCache writes, which have
    // no cleanup path in test runs and would otherwise leak across runs/users).
    if (!skipCache) {
        const cached = await context.staticCache.get(cacheKey);
        if (cached) {
            return cached;
        }
    }

    const subfolderIds = await getSubfolderIds(context, folderId);
    const folderIds = [folderId, ...subfolderIds];
    if (!skipCache) {
        await context.staticCache.set(cacheKey, folderIds, FOLDER_CACHE_TTL_MS);
    }

    return folderIds;
}

/**
 * Fetches Google Docs documents from Drive API.
 * @param {Object} context - Appmixer context
 * @param {string} folderId - Folder ID to filter by (non-recursive mode only)
 * @param {boolean} recursive - Whether recursive mode is enabled
 * @returns {Promise<Object[]>} Array of document objects
 */
async function fetchDocuments(context, folderId, recursive) {

    let query = `mimeType='${GOOGLE_DOCS_MIME_TYPE}' and trashed=false`;
    if (folderId && !recursive) {
        query += ` and '${folderId}' in parents`;
    }

    const { data } = await context.httpRequest({
        method: 'GET',
        url: 'https://www.googleapis.com/drive/v3/files',
        params: {
            q: query,
            fields: 'files(id,name,mimeType,createdTime,modifiedTime,webViewLink,owners,lastModifyingUser,parents)',
            orderBy: 'createdTime desc',
            pageSize: 100
        },
        headers: {
            'Authorization': `Bearer ${context.auth.accessToken}`
        }
    });

    return data.files || [];
}

/**
 * Filters documents to only include those in monitored folders.
 * @param {Object[]} documents - Array of document objects
 * @param {string[]} folderIds - Array of monitored folder IDs
 * @returns {Object[]} Filtered array of documents
 */
function filterByFolders(documents, folderIds) {

    if (!folderIds.length) {
        return documents;
    }

    return documents.filter(doc =>
        doc.parents?.some(parentId => folderIds.includes(parentId))
    );
}

/**
 * Identifies new documents by comparing with known IDs.
 * @param {Object[]} documents - Array of document objects
 * @param {Set|null} knownIds - Set of previously known document IDs, or null for first run
 * @returns {{ newDocs: Object[], currentIds: string[] }} New documents and current ID list
 */
function identifyNewDocuments(documents, knownIds) {

    const newDocs = [];
    const currentIds = [];

    for (const doc of documents) {
        currentIds.push(doc.id);
        if (knownIds && !knownIds.has(doc.id)) {
            newDocs.push(doc);
        }
    }

    return { newDocs, currentIds };
}

module.exports = {

    async tick(context) {

        let lock;
        try {
            lock = await context.lock(context.componentId, {
                ttl: 5 * 60 * 1000,
                maxRetryCount: 0
            });
        } catch (e) {
            return; // Another tick is already running
        }

        try {
            const { folder = {}, recursive } = context.properties;
            const folderId = typeof folder === 'string' ? folder : folder.id;

            const state = await context.loadState();
            const knownIds = state.known ? new Set(state.known) : null;

            const folderIds = await getMonitoredFolderIds(context, folderId, recursive);
            let documents = await fetchDocuments(context, folderId, recursive);

            if (folderId && recursive) {
                documents = filterByFolders(documents, folderIds);
            }

            const { newDocs, currentIds } = identifyNewDocuments(documents, knownIds);

            for (const doc of newDocs) {
                await context.sendJson(doc, 'out');
            }

            await context.saveState({ ...state, known: currentIds });
        } finally {
            lock?.unlock();
        }
    },

    // Flow Test Mode: emit one representative document using the SAME fetch/filter path as
    // tick() (newest-first via orderBy createdTime desc), mirroring the recursive branch, but
    // WITHOUT dedup state, locking or state writes.
    async test(context) {

        const { folder = {}, recursive } = context.properties;
        const folderId = typeof folder === 'string' ? folder : folder.id;

        const folderIds = await getMonitoredFolderIds(context, folderId, recursive, { skipCache: true });
        let documents = await fetchDocuments(context, folderId, recursive);

        if (folderId && recursive) {
            documents = filterByFolders(documents, folderIds);
        }

        if (!documents.length) {
            throw new Error('No documents found to use as test data.');
        }

        // fetchDocuments orders by createdTime desc, so the first entry is the newest.
        return context.sendJson(documents[0], 'out');
    }
};

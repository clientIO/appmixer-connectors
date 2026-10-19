'use strict';

/**
 * Stand-in for the Wiz GraphQL API + its signed upload URLs, used to drive the
 * wiz connector's success path on a live Appmixer instance (we have no Wiz
 * console access, so no real Enrichment Integration ID exists for E2E).
 *
 * Behaviour knobs (query string on /_reset or env):
 *   inProgressPolls - systemActivity polls answered IN_PROGRESS before SUCCESS
 *   resourcesTotal  - size of the synthetic cloudResources tenant
 */

const http = require('http');

const PORT = parseInt(process.env.PORT, 10) || 4599;

const config = {
    inProgressPolls: parseInt(process.env.IN_PROGRESS_POLLS, 10) || 1,
    resourcesTotal: parseInt(process.env.RESOURCES_TOTAL, 10) || 1200
};

const state = {
    uploadRequests: [],
    uploads: [],
    statusPolls: {},
    resourcePages: []
};

let uploadCounter = 0;

function readBody(req) {

    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

function json(res, status, payload) {

    const body = JSON.stringify(payload);
    res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
    res.end(body);
}

function handleGraphql(req, res, body) {

    let payload;
    try {
        payload = JSON.parse(body.toString('utf8'));
    } catch (e) {
        return json(res, 400, { errors: [{ message: 'Invalid JSON body' }] });
    }

    const query = payload.query || '';
    const variables = payload.variables || {};

    if (query.includes('requestSecurityScanUpload')) {
        uploadCounter++;
        const id = String(3400000 + uploadCounter);
        const systemActivityId = `activity-${uploadCounter}`;
        state.uploadRequests.push({ id, systemActivityId, filename: variables.filename, at: new Date().toISOString() });
        return json(res, 200, {
            data: {
                requestSecurityScanUpload: {
                    upload: {
                        id,
                        url: `https://${req.headers.host}/upload/${id}`,
                        systemActivityId
                    }
                }
            }
        });
    }

    if (query.includes('systemActivity')) {
        const id = variables.id;
        state.statusPolls[id] = (state.statusPolls[id] || 0) + 1;
        const polls = state.statusPolls[id];

        const request = state.uploadRequests.find(entry => entry.systemActivityId === id);
        if (!request) {
            return json(res, 200, {
                data: { systemActivity: null },
                errors: [{ message: 'Resource not found', extensions: { code: 'NOT_FOUND' } }]
            });
        }

        if (polls <= config.inProgressPolls) {
            return json(res, 200, { data: { systemActivity: { id, status: 'IN_PROGRESS', statusInfo: null } } });
        }

        const upload = state.uploads.find(entry => entry.id === request.id);
        const dataSources = upload ? upload.dataSourcesCount : 0;
        return json(res, 200, {
            data: {
                systemActivity: {
                    id,
                    status: 'SUCCESS',
                    statusInfo: null,
                    result: {
                        dataSources: { incoming: dataSources, handled: dataSources },
                        findings: { incoming: 0, handled: 0 },
                        events: { incoming: 0, handled: 0 },
                        tags: { incoming: 0, handled: 0 }
                    },
                    context: { fileUploadId: request.id }
                }
            }
        });
    }

    if (query.includes('cloudResources')) {
        const first = parseInt(variables.first, 10);
        const after = parseInt(variables.after, 10) || 0;
        const pageSize = Number.isFinite(first) && first > 0 ? first : 500;
        const remaining = Math.max(0, config.resourcesTotal - after);
        const count = Math.min(pageSize, remaining);
        state.resourcePages.push({ first, after, count, at: new Date().toISOString() });

        const nodes = Array.from({ length: count }, (unused, index) => ({
            id: `mock-resource-${after + index}`,
            name: `mock-resource-${after + index}`,
            type: 'VIRTUAL_MACHINE',
            subscriptionId: 'mock-subscription',
            providerUniqueId: `arn:aws:ec2:eu-central-1:000000000000:instance/i-${after + index}`
        }));

        return json(res, 200, {
            data: {
                cloudResources: {
                    nodes,
                    pageInfo: {
                        hasNextPage: after + count < config.resourcesTotal,
                        endCursor: String(after + count)
                    }
                }
            }
        });
    }

    return json(res, 200, { data: { __typename: 'Query' } });
}

const server = http.createServer(async (req, res) => {

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/_state') {
        return json(res, 200, { config, ...state });
    }

    if (url.pathname === '/_reset') {
        state.uploadRequests = [];
        state.uploads = [];
        state.statusPolls = {};
        state.resourcePages = [];
        uploadCounter = 0;
        for (const key of ['inProgressPolls', 'resourcesTotal']) {
            if (url.searchParams.has(key)) {
                config[key] = parseInt(url.searchParams.get(key), 10);
            }
        }
        return json(res, 200, { ok: true, config });
    }

    const body = await readBody(req);

    if (req.method === 'PUT' && url.pathname.startsWith('/upload/')) {
        const id = url.pathname.slice('/upload/'.length);
        let dataSourcesCount = null;
        let dataSourceIds = null;
        try {
            const parsed = JSON.parse(body.toString('utf8'));
            dataSourcesCount = Array.isArray(parsed.dataSources) ? parsed.dataSources.length : null;
            dataSourceIds = Array.isArray(parsed.dataSources) ? parsed.dataSources.map(entry => entry.id) : null;
        } catch (e) {
            dataSourcesCount = null;
        }
        state.uploads.push({ id, bytes: body.length, dataSourcesCount, dataSourceIds, at: new Date().toISOString() });
        console.log(`PUT /upload/${id} bytes=${body.length} dataSources=${dataSourcesCount}`);
        res.writeHead(200, { 'content-type': 'text/plain' });
        return res.end('OK');
    }

    if (req.method === 'POST' && url.pathname === '/oauth/token') {
        // Stand-in for https://auth.app.wiz.io/oauth/token (client_credentials).
        console.log('POST /oauth/token');
        return json(res, 200, { access_token: 'mock-access-token', expires_in: 86400, token_type: 'bearer' });
    }

    if (req.method === 'POST' && (url.pathname === '/graphql' || url.pathname === '/')) {
        return handleGraphql(req, res, body);
    }

    json(res, 404, { errors: [{ message: `No mock route for ${req.method} ${url.pathname}` }] });
});

server.listen(PORT, () => console.log(`mock wiz listening on http://127.0.0.1:${PORT}`));

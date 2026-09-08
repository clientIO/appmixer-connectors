'use strict';

const crypto = require('crypto');

const lib = require('../../lib');

const DEFAULT_ACTIONS = ['edited'];

// The item fields test() needs to synthesize a delivery that is shaped exactly like
// a real `projects_v2_item` payload.
const testItemFields = `
    id
    databaseId
    createdAt
    updatedAt
    isArchived
    creator { login }
    content {
        __typename
        ... on Issue { id }
        ... on PullRequest { id }
        ... on DraftIssue { id }
    }
    fieldValueByName(name: "Status") {
        ... on ProjectV2ItemFieldSingleSelectValue {
            optionId
            name
            field { ... on ProjectV2SingleSelectField { id name } }
        }
    }
`;

const testProjectQuery = `
    query($org: String!, $projectId: ID!) {
        organization(login: $org) { id login databaseId }
        node(id: $projectId) {
            ... on ProjectV2 {
                id
                items(last: 1) { nodes { ${testItemFields} } }
            }
        }
    }
`;

const testLatestProjectQuery = `
    query($org: String!) {
        organization(login: $org) {
            id
            login
            databaseId
            projectsV2(first: 1, orderBy: { field: UPDATED_AT, direction: DESC }) {
                nodes {
                    id
                    items(last: 1) { nodes { ${testItemFields} } }
                }
            }
        }
    }
`;

const normalizeActions = actions => {

    if (Array.isArray(actions) && actions.length) return actions;
    if (typeof actions === 'string' && actions.trim()) {
        return actions.split(',').map(action => action.trim()).filter(Boolean);
    }
    return DEFAULT_ACTIONS;
};

// `changes.field_value.from`/`to` are objects for single select fields and plain
// scalars for text/number/date ones. Flatten to a string and expose the option ID
// separately so downstream flows can compare either.
const fieldValueName = value => {

    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return value.name || value.title || '';
    return String(value);
};

const fieldValueOptionId = value => (value && typeof value === 'object' ? (value.id || '') : '');

const toOutput = payload => {

    const item = payload.projects_v2_item || {};
    const fieldValue = payload.changes?.field_value || {};

    return {
        action: payload.action || '',
        projects_v2_item: {
            id: item.id,
            node_id: item.node_id || '',
            project_node_id: item.project_node_id || '',
            content_node_id: item.content_node_id || '',
            content_type: item.content_type || '',
            created_at: item.created_at || '',
            updated_at: item.updated_at || '',
            archived_at: item.archived_at || '',
            creator_login: item.creator?.login || ''
        },
        changes: {
            field_value: {
                field_node_id: fieldValue.field_node_id || '',
                field_name: fieldValue.field_name || '',
                field_type: fieldValue.field_type || '',
                from: fieldValueName(fieldValue.from),
                to: fieldValueName(fieldValue.to),
                from_option_id: fieldValueOptionId(fieldValue.from),
                to_option_id: fieldValueOptionId(fieldValue.to)
            }
        },
        sender: {
            login: payload.sender?.login || '',
            id: payload.sender?.id,
            type: payload.sender?.type || ''
        },
        organization: {
            login: payload.organization?.login || '',
            id: payload.organization?.id,
            node_id: payload.organization?.node_id || ''
        }
    };
};

const buildTestPayload = async (context, { organization, projectNodeId }) => {

    let org;
    let project;

    if (projectNodeId) {
        const data = await lib.graphqlRequest(context, testProjectQuery, {
            org: organization,
            projectId: projectNodeId
        });
        org = data?.organization;
        project = data?.node;
    } else {
        const data = await lib.graphqlRequest(context, testLatestProjectQuery, { org: organization });
        org = data?.organization;
        project = org?.projectsV2?.nodes?.[0];
    }

    const item = project?.items?.nodes?.[0];
    if (!item) return null;

    const status = item.fieldValueByName;
    const profile = context.auth?.profileInfo || {};

    return {
        action: 'edited',
        projects_v2_item: {
            id: item.databaseId,
            node_id: item.id,
            project_node_id: project.id,
            content_node_id: item.content?.id || '',
            content_type: item.content?.['__typename'] || '',
            created_at: item.createdAt,
            updated_at: item.updatedAt,
            archived_at: item.isArchived ? item.updatedAt : null,
            creator: { login: item.creator?.login }
        },
        changes: {
            field_value: {
                field_node_id: status?.field?.id || '',
                field_name: status?.field?.name || 'Status',
                field_type: 'single_select',
                from: null,
                to: status ? { id: status.optionId, name: status.name } : null
            }
        },
        sender: { login: profile.login, id: profile.id, type: profile.type },
        organization: { login: org?.login, id: org?.databaseId, node_id: org?.id }
    };
};

/**
 * The organization hook that already delivers to `url`, or null.
 * @param {Object} context
 * @param {string} organization
 * @param {string} url
 * @returns {Promise<Object|null>}
 */
async function findHookByUrl(context, organization, url) {

    const { data } = await lib.apiRequest(context, `orgs/${organization}/hooks`);
    return (Array.isArray(data) ? data : []).find(hook => hook.config && hook.config.url === url) || null;
}

/**
 * GitHub's own explanation of a failed request (message plus the `errors` details),
 * falling back to the transport error.
 * @param {Error} error
 * @returns {string}
 */
function githubErrorMessage(error) {

    const body = error.response && error.response.data;
    if (!body) return error.message;
    const details = Array.isArray(body.errors)
        ? body.errors.map(e => e.message || JSON.stringify(e)).join('; ')
        : '';
    return [body.message, details].filter(Boolean).join(' - ') || error.message;
}

module.exports = {

    async start(context) {

        const { organization, verifySignature } = context.properties;

        if (!organization) {
            throw new context.CancelError('Organization is required!');
        }

        const config = {
            url: context.getWebhookUrl(),
            content_type: 'json',
            insecure_ssl: '0'
        };

        // GitHub only signs deliveries of hooks that were registered with a secret.
        const secret = verifySignature ? crypto.randomBytes(32).toString('hex') : null;
        if (secret) {
            config.secret = secret;
        }

        const body = {
            name: 'web',
            active: true,
            // The board event itself; individual actions are filtered in receive().
            events: ['projects_v2_item'],
            config
        };

        let data;
        try {
            ({ data } = await lib.apiRequest(context, `orgs/${organization}/hooks`, { method: 'POST', body }));
        } catch (error) {
            // GitHub allows one hook per URL and answers 422 when an earlier start of this
            // very component left its hook behind (the flow start aborted before stop()
            // could run). Adopt that hook instead of failing, refreshing its config so the
            // secret matches the one stored below.
            const existing = error.response?.status === 422
                ? await findHookByUrl(context, organization, config.url)
                : null;
            if (!existing) {
                throw new context.CancelError(`Registering the organization webhook failed: ${githubErrorMessage(error)}`);
            }
            ({ data } = await lib.apiRequest(context, `orgs/${organization}/hooks/${existing.id}`, {
                method: 'PATCH',
                body: { active: true, events: body.events, config }
            }));
        }

        return context.saveState({ hookId: data.id, secret });
    },

    async receive(context) {

        if (!context.messages.webhook) return;

        const { headers = {}, data = {} } = context.messages.webhook.content;
        const { events, projectNodeId, verifySignature } = context.properties;
        const { secret } = await context.loadState() || {};

        if (verifySignature) {
            const valid = lib.verifyWebhookSignature({
                payload: data,
                signatureHeader: headers['x-hub-signature-256'],
                secret
            });
            if (!valid) {
                await context.log({ step: 'Dropped a projects_v2_item delivery with an invalid X-Hub-Signature-256 header.' });
                return context.response();
            }
        }

        const item = data.projects_v2_item;
        if (!item || !normalizeActions(events).includes(data.action)) {
            return context.response();
        }
        if (projectNodeId && item.project_node_id !== projectNodeId) {
            return context.response();
        }

        await context.sendJson(toOutput(data), 'out');

        return context.response();
    },

    async stop(context) {

        const { organization } = context.properties;
        const { hookId } = await context.loadState() || {};

        if (!hookId) return;

        try {
            await lib.apiRequest(context, `orgs/${organization}/hooks/${hookId}`, { method: 'DELETE' });
        } catch (err) {
            // Already gone on GitHub's side — nothing left to clean up.
            const status = err?.response?.status || err?.statusCode;
            if (status !== 404) throw err;
        }
    },

    async test(context) {

        const { organization, projectNodeId } = context.properties;

        if (!organization) {
            throw new Error('Organization is required.');
        }

        // Read-only: no webhook is registered. The newest card of the board is wrapped
        // in the same payload shape receive() emits so Flow Test Mode yields real data.
        const payload = await buildTestPayload(context, { organization, projectNodeId });
        if (!payload) {
            throw new Error('No project items to use as test data.');
        }

        return context.sendJson(toOutput(payload), 'out');
    }
};

'use strict';

const { API_BASE_URL, getHeaders, withCache } = require('../../lib');

const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const NAME_LOOKUP_CONCURRENCY = 5;
// Roles allowed to publish organic posts on behalf of the page.
const POSTING_ROLES = ['ADMINISTRATOR', 'CONTENT_ADMINISTRATOR'];
// Organization names rarely change and LinkedIn's Development tier allows only
// 100 calls per member per day, so keep the list longer than the default 2 min.
const CACHE_TTL = 15 * 60 * 1000;

/**
 * IDs of every page where the member holds an approved role that can post.
 * @param {Context} context
 * @returns {Promise<string[]>}
 */
async function fetchPostableOrganizationIds(context) {

    const ids = [];
    for (let page = 0; page < MAX_PAGES; page++) {
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${API_BASE_URL}/rest/organizationAcls`,
            params: {
                q: 'roleAssignee',
                state: 'APPROVED',
                start: page * PAGE_SIZE,
                count: PAGE_SIZE
            },
            headers: getHeaders(context)
        });

        const elements = (data && data.elements) || [];
        elements
            .filter(element => POSTING_ROLES.includes(element.role))
            .forEach(element => {
                // Docs show both `organization` and `organizationTarget` for this finder.
                const urn = element.organization || element.organizationTarget || '';
                const id = urn.split(':').pop();
                if (id && !ids.includes(id)) {
                    ids.push(id);
                }
            });

        if (elements.length < PAGE_SIZE) {
            break;
        }
    }
    return ids;
}

/**
 * @param {Context} context
 * @param {string} id Numeric organization ID.
 * @returns {Promise<{id: string, name: string}>}
 */
async function resolveOrganization(context, id) {

    let name = `Organization ${id}`;
    try {
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${API_BASE_URL}/rest/organizations/${id}`,
            headers: getHeaders(context)
        });
        name = (data && data.localizedName) || name;
    } catch (err) {
        if (err.response && err.response.status === 429) {
            // Out of API calls: fail the whole list so the fallback names are not cached.
            throw err;
        }
        context.log({ stage: 'Could not resolve the organization name.', id, error: err.message });
    }
    return { id, name };
}

/**
 * Lists LinkedIn organization pages the authenticated member can post to
 * (administrators and content administrators).
 * Private helper backing the organization dropdown in CreatePost.
 */
module.exports = {

    async receive(context) {

        try {
            const organizations = await withCache(context, { key: 'postableOrganizations' }, async () => {
                const ids = await fetchPostableOrganizationIds(context);
                // BATCH_GET is not available on LinkedIn's Development tier, so look names up one by one.
                const resolved = [];
                for (let i = 0; i < ids.length; i += NAME_LOOKUP_CONCURRENCY) {
                    const chunk = ids.slice(i, i + NAME_LOOKUP_CONCURRENCY);
                    resolved.push(...await Promise.all(chunk.map(id => resolveOrganization(context, id))));
                }
                return resolved;
            }, CACHE_TTL);
            return context.sendJson({ organizations }, 'out');
        } catch (err) {
            if (context.properties.isSource) {
                context.log({ stage: 'Could not list organizations for the dropdown.', error: err.message });
                return context.sendJson({ organizations: [] }, 'out');
            }
            throw err;
        }
    },

    organizationsToSelectArray(out) {

        return ((out && out.organizations) || []).map(org => ({
            label: `${org.name} (${org.id})`,
            value: org.id
        }));
    }
};

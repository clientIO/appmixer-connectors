'use strict';
const lib = require('../../lib');

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'title', 'url', 'created_time', 'last_edited_time', 'parent'],
    properties: {
        id: { type: 'string', title: 'Page ID', example: 'b8c9d0e1-f2a3-4567-bcde-678901234567' },
        title: { type: 'string', title: 'Title', example: 'Launch plan' },
        url: {
            type: 'string',
            title: 'URL',
            example: 'https://app.notion.com/p/Launch-plan-b8c9d0e1f2a34567bcde678901234567'
        },
        public_url: {
            type: ['string', 'null'],
            title: 'Public URL',
            example: 'https://acme.notion.site/Launch-plan-b8c9d0e1f2a34567bcde678901234567'
        },
        created_time: { type: 'string', title: 'Created Time', example: '2025-12-01T08:00:00.000Z' },
        last_edited_time: { type: 'string', title: 'Last Edited Time', example: '2026-01-15T10:30:00.000Z' },
        parent: {
            type: 'object',
            title: 'Parent',
            required: ['type'],
            properties: {
                type: { type: 'string', title: 'Parent.Type', example: 'page_id' },
                page_id: {
                    type: 'string',
                    title: 'Parent.Page ID',
                    example: 'e5f6a7b8-c9d0-1234-efab-345678901234'
                },
                database_id: {
                    type: 'string',
                    title: 'Parent.Database ID',
                    example: '9b4c8f2e-1d3a-4e5b-8c7d-6f0a1b2c3d4e'
                },
                block_id: {
                    type: 'string',
                    title: 'Parent.Block ID',
                    example: '7a1d2c3b-4e5f-4a6b-9c8d-0e1f2a3b4c5d'
                },
                workspace: { type: 'boolean', title: 'Parent.Workspace', example: true }
            }
        }
    }
};

// The title lives in the property of type `title`. It is named `title` on a plain
// page, but carries the column's own name (e.g. `Name`) on a database item.
const getTitle = (page) => {
    const titleProperty = Object.values(page.properties || {}).find(property => property.type === 'title');
    const title = (titleProperty?.title || []).map(fragment => fragment.plain_text).join('');
    return title || 'Untitled';
};

const search = async (context, objectType) => {
    const { data } = await lib.callEndpoint(context, '/search', {
        method: 'POST',
        data: {
            filter: {
                value: objectType,
                property: 'object'
            },
            sort: {
                direction: 'descending',
                timestamp: 'last_edited_time'
            },
            page_size: 100
        }
    });

    return data.results || [];
};

const fetchPages = async (context) => {
    const pages = await search(context, 'page');

    return pages.map(page => ({
        id: page.id,
        title: getTitle(page),
        url: page.url,
        public_url: page.public_url,
        created_time: page.created_time,
        last_edited_time: page.last_edited_time,
        parent: page.parent
    }));
};

const fetchDatabases = async (context) => {
    const databases = await search(context, 'database');

    return databases.map(database => ({
        id: database.id,
        title: (database.title || []).map(fragment => fragment.plain_text).join('') || 'Untitled',
        parent: database.parent
    }));
};

const PATH_SEPARATOR = ' / ';

// Pages form a tree (page → subpage, database → item), but a dropdown is a flat list.
// Each page is therefore labelled with its path from the topmost ancestor the
// integration can see (`Wiki / Onboarding / Day one`, `Tasks / Fix login`), and the
// list is ordered as the tree reads: a page is followed by its descendants.
const toPageOptions = (pages, databases) => {
    const pageIds = new Set(pages.map(page => page.id));
    const nodes = new Map([...databases, ...pages].map(node => [node.id, node]));

    // A node whose parent the integration cannot see (not shared, a block, beyond
    // the 100 listed) starts its own tree, the same as a workspace-level one.
    const roots = [];
    const children = new Map();
    for (const node of nodes.values()) {
        const parentId = node.parent?.page_id || node.parent?.database_id;
        if (nodes.has(parentId) && parentId !== node.id) {
            children.set(parentId, [...(children.get(parentId) || []), node]);
        } else {
            roots.push(node);
        }
    }

    const byTitle = (a, b) => a.title.localeCompare(b.title);
    const options = [];
    const visited = new Set();
    const walk = (node, ancestors) => {
        if (visited.has(node.id)) {
            return;
        }
        visited.add(node.id);
        const path = [...ancestors, node.title];
        // Databases only name the path — a page cannot be created under one here.
        if (pageIds.has(node.id)) {
            options.push({ id: node.id, path: path.join(PATH_SEPARATOR) });
        }
        (children.get(node.id) || []).sort(byTitle).forEach(child => walk(child, path));
    };
    roots.sort(byTitle).forEach(root => walk(root, []));
    // Nodes on a parent cycle have no root; list them anyway rather than drop them.
    nodes.forEach(node => walk(node, []));

    return options;
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {
        const { outputType = 'array' } = context.messages.in?.content || {};
        const { generateOutputPortOptions, isSource } = context.properties;

        if (generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, {
                label: 'Pages',
                value: 'result'
            });
        }

        if (!isSource) {
            const records = await fetchPages(context);
            return lib.sendArrayOutput({ context, outputType, records });
        }

        // Source call: backs a page dropdown in the inspector. Cached, and a failure
        // renders an empty dropdown rather than an error — the input is a typeahead,
        // so the ID can still be typed in.
        try {
            const result = await lib.withCache(context, ['ListPages'], async () => {
                // Both or nothing: labels built without the databases would be cached
                // for the whole TTL, while a failure is not cached and is retried on
                // the next inspector open.
                const [pages, databases] = await Promise.all([
                    fetchPages(context),
                    fetchDatabases(context)
                ]);
                // Only the fields the dropdown needs, to keep the cache small.
                return toPageOptions(pages, databases);
            });
            return context.sendJson({ result }, 'out');
        } catch (err) {
            return context.sendJson({ result: [] }, 'out');
        }
    },

    pageToSelectArray({ result }) {
        return (result || []).map(page => {
            return { label: page.path, value: page.id };
        });
    }
};

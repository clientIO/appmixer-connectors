'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function (context) {
        let { searchTerm, entity, onlyTextAndNumber } = context.messages.in.content || {};
        let q = {};
        if (searchTerm !== null && searchTerm !== undefined) {
            q.searchTerm = searchTerm;
        }
        q.entities = entity;
        // Include options for dropdown/status choices; must also request id, name, type etc. or API returns only requested fields
        q['fields[customfields]'] = 'id,name,type,entity,projectId,options';

        let allCustomfields = [];
        let page = 1;
        let pageSize = 500;
        let hasMore = true;
        try {
            while (hasMore) {
                q.page = page;
                q.pageSize = pageSize;

                let resp = await lib.callAPI(
                    context,
                    "GET",
                    '/projects/api/v3/customfields.json',
                    null,
                    q
                );

                if (resp && Array.isArray(resp.customfields)) {
                    allCustomfields = allCustomfields.concat(resp.customfields);
                } else {
                    throw new Error('Invalid API response structure');
                }

                hasMore = resp.meta?.page?.hasMore || false;
                page++;
            }
        } catch (error) {
            throw new Error(`Error fetching customfields: ${error.message}`);
        }

        // When onlyTextAndNumber is true (CreateProject, CreateTask, etc.), only return text and number fields
        if (onlyTextAndNumber) {
            const textAndNumberTypes = ['text-short', 'number-integer', 'number-decimal'];
            allCustomfields = allCustomfields.filter((cf) => textAndNumberTypes.includes(cf.type));
        }

        // When used as source with customFieldId (e.g. for was/is dropdown options), send options for that field
        const customFieldId = context.properties?.customFieldId;
        let optionsPayload = { options: [] };
        if (customFieldId && customFieldId !== 'any') {
            const parts = String(customFieldId).split('-');
            const id = parseInt(parts[0], 10);
            const field = allCustomfields.find((cf) => cf.id === id);
            const choices = field?.options?.choices || [];
            optionsPayload.options = choices.map((c) => ({
                content: c.value != null ? String(c.value) : '',
                value: c.value != null ? String(c.value) : ''
            })).filter((o) => o.value !== '');
        }
        await context.sendJson(optionsPayload, 'options');

        return context.sendJson({ customfields: allCustomfields }, 'customfields');
    },

    toInspector: function (data) {
        const transformed = [];
        if (!data || !Array.isArray(data.customfields)) {
            return transformed;
        }
        const typeLabel = {
            'text-short': 'Text',
            'number-integer': 'Number',
            'checkbox': 'Checkbox',
            'date': 'Date',
            'url': 'URL',
            'dropdown': 'Dropdown',
            'status': 'Status',
        };
        data.customfields.forEach((customfield) => {
            if (customfield.projectId) {
                return;
            }
            const apiType = customfield.type || 'text-short';
            const label = typeLabel[apiType] || apiType;
            transformed.push({
                label: `${customfield.name} (${label})`,
                value: `${customfield.id}-${apiType}`
            });
        });
        return transformed;
    },

    optionsToInspector: function (data) {
        if (!data || !Array.isArray(data.options)) {
            return [];
        }
        return data.options.map((opt) => ({
            content: opt.content != null ? String(opt.content) : '',
            value: opt.value != null ? String(opt.value) : ''
        }));
    }
}

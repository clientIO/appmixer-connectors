'use strict';

const lib = require('../../lib');

const FIELDS = 'id,name,language,status,category';

module.exports = {

    async receive(context) {

        const inputWaba = context.messages.in.content.businessAccountId;
        const profileWaba = context.profileInfo && context.profileInfo.businessAccountId;
        const businessAccountId = inputWaba || profileWaba;

        const isSource = !!(context.properties && context.properties.isSource);

        if (!businessAccountId) {
            if (isSource) {
                return context.sendJson({ templates: [], count: 0 }, 'out');
            }
            throw new context.CancelError('Business Account ID is required!');
        }

        try {
            const path = `/${businessAccountId}/message_templates`;
            const params = { fields: FIELDS, limit: 100 };

            const { data } = isSource
                ? await lib.apiRequestCached(context, { path, params })
                : await lib.apiRequest(context, { method: 'GET', path, params });

            const templates = (data.data || []).map(item => ({
                id: item.id,
                name: item.name,
                language: item.language,
                status: item.status,
                category: item.category
            }));

            return context.sendJson({
                templates,
                count: templates.length
            }, 'out');

        } catch (err) {
            if (isSource) {
                return context.sendJson({ templates: [], count: 0 }, 'out');
            }
            throw err;
        }
    },

    // Transformer for dynamic-source dropdowns.
    // Only surfaces APPROVED templates — REJECTED / PAUSED / IN_APPEAL can't be sent.
    // Label includes language code to disambiguate name+lang variants.
    toSelectArray(out) {

        const templates = (out && out.templates) || [];
        const approved = templates.filter(t => t.status === 'APPROVED');

        // Dedup by name (Meta allows the same name in multiple languages).
        const seen = new Set();
        const result = [];
        for (const t of approved) {
            if (seen.has(t.name)) continue;
            seen.add(t.name);
            result.push({
                label: t.language ? `${t.name}  (${t.language})` : t.name,
                value: t.name
            });
        }
        return result;
    }
};

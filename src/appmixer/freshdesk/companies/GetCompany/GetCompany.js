'use strict';

const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        const companyId = parseInt(context.messages.in.content.companyId, 10);

        let data;
        try {
            const response = await apiCall(context, { url: `/companies/${companyId}` });
            data = response.data;
        } catch (err) {
            if (err.response?.status === 404) {
                return context.sendJson({ companyId }, 'notFound');
            }
            throw err;
        }

        if (!data || !data.id) {
            return context.sendJson({ companyId }, 'notFound');
        }

        return context.sendJson({
            id: data.id,
            name: data.name,
            description: data.description,
            note: data.note,
            domains: data.domains,
            healthScore: data.health_score,
            accountTier: data.account_tier,
            renewalDate: data.renewal_date,
            industry: data.industry,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        }, 'company');
    }
};

'use strict';

const { apiCall, trimUndefined } = require('../../lib');

module.exports = {

    async receive(context) {

        const content = context.messages.in.content;

        const body = trimUndefined({
            name: content.name,
            description: content.description,
            note: content.note,
            domains: content.domains ? content.domains.split(',').map(d => d.trim()) : undefined,
            health_score: content.healthScore,
            account_tier: content.accountTier,
            renewal_date: content.renewalDate,
            industry: content.industry
        });

        const response = await apiCall(context, {
            method: 'POST',
            url: '/companies',
            data: body
        });

        const data = response.data;
        return context.sendJson(mapCompany(data), 'company');
    }
};

function mapCompany(data) {

    return {
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
    };
}

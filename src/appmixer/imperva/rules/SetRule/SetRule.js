'use strict';

const { baseUrl } = require('../../lib');

module.exports = {

    receive: async function(context) {

        const { siteId, name, filter, action, ttl } = context.messages.in.content;

        let rule = {
            // Other fields will be added in create or update steps
            siteId
        };

        // Fetch all rules for the site. Interested only in the incap_rules.
        let maxPages = 10;
        const pageSize = 100;
        let currentPage = 0;
        let ruleId = null;

        // Current limitation of the Imperva API is that it doesn't support filtering at all.
        // So we need to fetch all rules and filter them on our side.
        while (currentPage < maxPages && !ruleId) {

            const { data } = await context.httpRequest({
                headers: {
                    'x-API-Id': context.auth.id,
                    'x-API-Key': context.auth.key
                },
                url: `${baseUrl}/v1/sites/incapRules/list?site_id=${siteId}&page_size=${pageSize}&page_num=${currentPage}&include_incap_rules=true&include_ad_rules=false`,
                method: 'POST'
            });
            // Check for Imperva specific errors.
            if (data.res !== '0') {
                throw new context.CancelError(JSON.stringify(data));
            }
            const rules = data?.incap_rules?.All || [];
            if (rules?.length === 0) {
                break;
            }

            // Find the ruleId by filter and action
            for (const rule of rules) {
                if (rule.filter === filter && rule.action === action) {
                    ruleId = rule.id;
                    break;
                }
            }

            currentPage++;
        }

        if (ruleId) {

            rule = { ...rule, rule_id: ruleId, name, filter, action };
        } else {


            const { data } = await context.httpRequest({
                headers: {
                    'x-API-Id': context.auth.id,
                    'x-API-Key': context.auth.key
                },
                url: `${baseUrl}/v2/sites/${siteId}/rules`,
                method: 'POST',
                data: {
                    name,
                    filter,
                    action,
                    ttl
                }
            });

            rule = { ...rule, ...data };

        }

        if (ttl) {
            const serviceStateKey = `imperva-rule-delete-${siteId}-${rule.rule_id}`;
            const removeAfter = new Date().getTime() + ttl * 1000;
            await context.service.stateSet(serviceStateKey, removeAfter);
        }

        return context.sendJson(rule, 'out');
    }
};

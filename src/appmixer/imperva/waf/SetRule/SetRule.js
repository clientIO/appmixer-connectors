'use strict';

const { baseUrl } = require('../../lib');

module.exports = {

    receive: async function(context) {

        const { siteId, name, action, filterParameter, filterValue, ttl } = context.messages.in.content;

        // Fetch all rules for the site. Interested only in the incap_rules.
        const maxPages = 10;
        const pageSize = 100;
        let currentPage = 0;
        /** Rule ID of an existing rule in Imperva. */
        let ruleId = null;
        /** Rule object returned to Appmixer. */
        let rule = {
            // Other fields will be added in create or update steps
            siteId
        };
        const filterWhole = `${filterParameter} ${filterValue}`;

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
            await context.log({ step: 'Fetched rules', data });
            const rules = data?.incap_rules?.All || [];
            if (rules?.length === 0) {
                await context.log({ step: 'No more rules at', currentPage });
                break;
            }

            // Find the ruleId by filter and action.
            // Looking for exact match of filter and action.
            for (const rule of rules) {
                if (rule.filter === filterWhole && rule.action === action) {
                    ruleId = rule.id;
                    await context.log({ step: 'Rule found', ruleId });
                    break;
                }
            }

            currentPage++;
        }

        if (ruleId) {

            await context.log({ step: 'Rule already exists', ruleId });
            // The rule exists, we only need to update TTL in the serviceState. `ttl` is in seconds and is optional.
            rule = { ...rule, rule_id: ruleId, name, filter: filterWhole, action };
        } else {

            await context.log({ step: 'Creating a new rule' });

            const { data } = await context.httpRequest({
                headers: {
                    'x-API-Id': context.auth.id,
                    'x-API-Key': context.auth.key
                },
                url: `${baseUrl}/v2/sites/${siteId}/rules`,
                method: 'POST',
                data: {
                    name,
                    filter: filterWhole,
                    action,
                    ttl
                }
            });

            rule = { ...rule, ...data };

            await context.log({ step: 'Rule created', data });
        }

        if (ttl) {
            const serviceStateKey = `imperva-rule-delete-${siteId}-${rule.rule_id}`;
            const removeAfter = new Date().getTime() + ttl * 1000;
            const task = await context.callAppmixer({
                endPoint: '/plugins/appmixer/imperva/rules',
                method: 'POST',
                body: {
                    ruleId: rule.rule_id,
                    siteId,
                    removeAfter,
                    auth: {
                        id: context.auth.id,
                        key: context.auth.key
                    },
                    apiId: context.auth.id,
                    apiKey: context.auth.key
                }
            });

            await context.log({ step: 'Creating a rule with TTL', ttl, removeAfter, serviceStateKey, task });
        }

        return context.sendJson(rule, 'out');
    }
};

'use strict';

const { baseUrl } = require('../../lib');

module.exports = {

    receive: async function(context) {

        const { siteId, ips, ttl } = context.messages.in.content;

        /** Rule ID of an existing rule in Imperva. */
        const ruleName = 'Custom IP Block Rule ' + new Date().getTime();
        const action = 'RULE_ACTION_BLOCK';
        const filter = ips.split(',').map(ip => `ClientIP == ${ip}`).join(' & ');

         await context.log({ step: 'Creating a new rule' });

        const { data } = await context.httpRequest({
            headers: {
                'x-API-Id': context.auth.id,
                'x-API-Key': context.auth.key
            },
            url: `${baseUrl}/v2/sites/${siteId}/rules`,
            method: 'POST',
            data: {
                name: ruleName,
                filter,
                action
            }
        });

        rule = { ...rule, ...data };

         await context.log({ step: 'Rule created', data });

        if (ttl) {
            const serviceStateKey = `imperva-rule-delete-${siteId}-${rule.rule_id}`;
            const removeAfter = new Date().getTime() + ttl * 1000;
            const task = await context.callAppmixer({
                endPoint: '/plugins/appmixer/imperva/rules-block-ips',
                method: 'POST',
                body: {
                    ruleId: rule.rule_id,
                    siteId,
                    removeAfter,
                    auth: {
                        id: context.auth.id,
                        key: context.auth.key
                    }
                }
            });

            await context.log({ step: 'Creating a rule with TTL', ttl, removeAfter, serviceStateKey, task });
        }

        return context.sendJson(rule, 'out');
    }
};

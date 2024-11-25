'use strict';

const { baseUrl } = require('../../lib');

module.exports = {

    receive: async function(context) {

        const { siteId, name, filter, action, ttl } = context.messages.in.content;

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

        await context.log({ step: 'Rule created', data });

        if (ttl) {
            const now = new Date();
            // Fake it to be in 1 min in the future
            const inTheFuture = new Date(now.getTime() + ttl * 60000);
            const removeAfter = inTheFuture.getTime();
            /* Creating record in `serviceState`:
            {
                "key" : "imperva-rule-delete-{siteId}-{ruleId}",
                "service" : "appmixer-imperva",
                "value" : {removeAfter}
            }
            */
            const serviceStateKey = `imperva-rule-delete-${siteId}-${data.rule_id}`;
            await context.log({ step: 'Creating a rule with TTL', ttl, removeAfter, serviceStateKey });
            await context.service.stateSet(serviceStateKey, removeAfter);
            // Only works in plugins
            // await context.scheduleJob(`imperva-rule-delete-${data.id}`, cronTimeFromTTL, async () => {
            //     await context.log('info', '[IMPERVA] Deleting rule with TTL', data.id);
            //     await context.httpRequest({
            //         headers: {
            //             'x-API-Id': context.auth.id,
            //             'x-API-Key': context.auth.key
            //         },
            //         url: `${baseUrl}/v2/sites/${siteId}/rules/${data.id}`,
            //         method: 'DELETE'
            //     });
            // });
        }

        return context.sendJson({ ...data, siteId }, 'out');
    }
};

'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${lib.BASE_URL}/v1/usage`,
            headers: lib.authHeaders(context)
        });

        if (!data?.usage || !data?.links || typeof data.usage.plan !== 'string') {
            throw new context.CancelError('Latchshot returned an invalid usage response.');
        }

        const plan = data.usage.plan;
        const planName = plan === 'trial' ? 'Free' : `${plan.slice(0, 1).toUpperCase()}${plan.slice(1)}`;

        return context.sendJson({
            plan,
            planName,
            period: data.usage.period,
            limit: data.usage.limit,
            successful: data.usage.successful,
            failed: data.usage.failed,
            remaining: data.usage.remaining,
            resetAt: data.usage.resetAt,
            plansUrl: data.links.plans,
            requestPaidPlanUrl: data.links.requestPaidPlan,
            implementationPilotUrl: data.links.implementationPilot
        }, 'out');
    }
};

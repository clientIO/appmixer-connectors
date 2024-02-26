'use strict';
const getEnvVar = (name, defaultValue, parser) => {

    let envVar = process.env[name];
    return envVar ? (typeof parser === 'function' ? parser(envVar) : envVar) : defaultValue;
};

module.exports = context => {

    return {

        peopleTasksDashboard: context.config.dashboardUrl || getEnvVar('PEOPLE_TASKS_DASHBOARD_URL', null),

        dueTasksJob: {

            schedule: context.config.dueTasksSchedule || '0 */1 * * * *'
        },

        resubmitFailedWebhooksJob: {
            schedule: context.config.failedWebhooksSchedule || '0 */10 * * * *'
        },

        triggerWebhooksConcurrencyLimit: context.config.triggerWebhooksConcurrency || 50
    };
};

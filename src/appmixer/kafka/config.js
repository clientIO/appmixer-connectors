'use strict';

module.exports = context => {

    return {
        syncConnectionsJob: {

            schedule: context.config.syncConnectionsSchedule || '0 */1 * * * *'
        }
    };
};

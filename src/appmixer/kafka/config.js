'use strict';

module.exports = context => {

    return {
        reconnectJob: {

            schedule: context.config.reconnectSchedule || '0 */1 * * * *'
        },
        disconnectJob: {

            schedule: context.config.disconnectSchedule || '0 */1 * * * *'
        }
    };
};

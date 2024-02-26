'use strict';
const commons = require('../../userengage-commons');

/**
 * Sync source component for Userengage. On start it gets all users from Userengage
 * and then with each 'tick' gets newly created or updated users.
 */
module.exports = {

    /**
     * Get all users from Userengage on start.
     * @param {Context} context
     * @return {Promise}
     */
    start(context) {

        let { apiKey } = context.auth;

        let since = commons.getTimestamp();
        return commons.getUsers(apiKey)
            .then(users => {
                users.forEach(user => {
                    context.sendJson({ phase: 'init', source: 'userengage', data: user }, 'user');
                });
                context.state = {
                    since: since        // will be used in tick() method
                };
                context.sendJson({ phase: 'init-done', source: 'userengage' }, 'user');
            });
    },

    /**
     * With every tick check userengage for newly created or updated users.
     * @param {Context} context
     */
    tick(context) {

        if (!context.state.since) {
            context.sendError('Tick before SINCE stored in component state.');
            return;
        }

        let { apiKey } = context.auth;

        let since = commons.getTimestamp();
        return commons.getUsers(apiKey, { search: 'updated_at', min: context.state.since })
            .then(users => {
                users.forEach(user => {
                    context.sendJson({
                        phase: 'increment',
                        source: 'userengage',
                        data: user
                    }, 'user');
                });

                context.state = {
                    since: since
                };
            });
    }
};

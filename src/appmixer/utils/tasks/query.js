'use strict';

module.exports = context => {

    const { createBase, addSelector } = context.db.queryBuilder;

    return {

        /**
         * Builds and returns a selector from query parameters.
         * @param {Object} userSelector
         * @param {Object} options
         * @param {boolean} [options.private] Whether to include private tasks on the query
         * @param {string} [options.filter] comma separated list of filters with format column:value
         * @param {string} [options.role] Filter the tasks by role (approver or requester)
         * @param {string} [options.pattern] regular expression for filtering tasks by name
         * @param {string} [options.sort] string with format column:direction indicating how the results must be sorted
         * @param {string} [options.sharedWithPermissions} comma separated list of permissions a shared flow must have
         * @return {{
         *     selector,
         *     projection,
         *     sort,
         *     limit,
         *     offset
         * }}
         */
        buildTasksQuery: function(userSelector, options = {}) {

            let { selector, limit, offset, sort, projection } = createBase(options);

            if (options.pattern) {
                addSelector(selector, 'title', { $regex: options.pattern, $options: 'i' });
            }

            let roleSelector;
            if (userSelector.email) {
                roleSelector = this.getRoleSelectorForEmail(userSelector.email, options.role);
            } else {
                roleSelector = this.getRoleSelectorForSecret(userSelector.secret, options.role);
            }

            return {
                selector: {
                    $and: [
                        roleSelector,
                        selector
                    ]
                },
                sort,
                limit,
                offset,
                projection
            };
        },

        /**
         * Returns the partial selector to match tasks by email
         * @param {string} email
         * @param {string} role
         * @returns {Object}
         */
        getRoleSelectorForEmail: function(email, role) {

            let roleSelector;
            if (role) {
                roleSelector = { [role]: email };
            } else {
                roleSelector = {
                    $or: [
                        { approver: email },
                        { requester: email }

                    ]
                };
            }
            return roleSelector;
        },

        /**
         * Returns the partial selector to match tasks by secret
         * @param {string} secret
         * @param {string} role
         * @returns {Object}
         */
        getRoleSelectorForSecret: function(secret, role) {

            let roleSelector;
            if (role) {
                roleSelector = { [`${role}Secret`]: secret };
            } else {
                roleSelector = {
                    $or: [
                        { approverSecret: secret },
                        { requesterSecret: secret }

                    ]
                };
            }
            return roleSelector;
        }
    };
};

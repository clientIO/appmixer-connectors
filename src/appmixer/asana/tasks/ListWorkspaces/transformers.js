'use strict';

/**
 * Transformer for workspaces in account
 * @param {Object|string} workspaces
 */
module.exports.workspacesToSelectArray = workspaces => {

    let transformed = [];

    if (Array.isArray(workspaces)) {
        workspaces.forEach(workspace => {

            transformed.push({
                label: workspace['name'],
                value: workspace['gid']
            });
        });
    }

    return transformed;
};

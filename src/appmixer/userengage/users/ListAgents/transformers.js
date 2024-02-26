'use strict';

/**
 * Transformer for agents in userengage
 * @param {Object|string} agents
 */
module.exports.agentsToSelectArray = agents => {

    let transformed = [];

    if (Array.isArray(agents)) {
        agents.forEach(agent => {

            transformed.push({
                label: agent['email'],
                value: agent['email']
            });
        });
    }

    return transformed;
};

/**
 * Transformer for agents ids in userengage
 * @param {Object|string} agents
 */
module.exports.agentsIdToSelectArray = agents => {

    let transformed = [];

    if (Array.isArray(agents)) {
        agents.forEach(agent => {

            transformed.push({
                label: agent['name'],
                value: agent['id']
            });
        });
    }

    return transformed;
};

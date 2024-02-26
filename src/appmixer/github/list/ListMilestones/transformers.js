'use strict';

/**
 * Transformer for list of milestones
 * @param {Object|string} milestones
 */
module.exports.milestonesToSelectArray = milestones => {

    let transformed = [];

    if (Array.isArray(milestones)) {
        milestones.forEach(milestone => {

            transformed.push({
                label: milestone['title'],
                value: milestone['number']
            });
        });
    }

    return transformed;
};

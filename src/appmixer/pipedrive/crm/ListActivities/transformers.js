'use strict';

/**
 * @param {Object|string} activities
 */
module.exports.activitiesToSelectArray = activities => {

    let transformed = [];

    if (Array.isArray(activities)) {
        activities.forEach(activity => {
            transformed.push({
                label: activity.subject,
                value: activity.id
            });
        });
    }

    return transformed;
};

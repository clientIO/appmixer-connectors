'use strict';

/**
 * @param {Object|string} activities
 */
module.exports.activitiesToSelectArray = activities => {
    if (activities.length > 0) {
        return activities.map(activity => {
            return { label: activity.subject, value: activity.id };
        });
    } else {
        return [];
    }
};

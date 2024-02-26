'use strict';

/**
 *  @param {Array} members
 */
module.exports.membersToSelectArray = members => {

    let transformed = [];

    if (Array.isArray(members)) {
        members.forEach(member => {
            transformed.push({
                label: member['email_address'],
                value: member.id
            });
        });
    }

    return transformed;
};

'use strict';

/**
 * Transformer for conversations in userengage
 * @param {Object|string} conversations
 */
module.exports.conversationsToSelectArray = conversations => {

    let transformed = [];

    if (Array.isArray(conversations)) {
        conversations.forEach(conversation => {

            const user = conversation['user'];
            transformed.push({
                label: `${user['name']} (${user['email'] ? user['email'] : 'no email'})`,
                value: conversation['id']
            });
        });
    }

    return transformed;
};

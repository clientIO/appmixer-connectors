'use strict';

const commons = require('../../jira-commons');

module.exports = {

    async receive(context) {

        const { profileInfo, auth } = context;
        const { id } = context.messages.in.content;

        try {
            const transitions = await commons.get(`${profileInfo.apiUrl}issue/${id}/transitions`, auth);
            return context.sendJson(transitions, 'out');
        } catch (e) {
            if (context.properties.variablesFetch) {
                return context.sendJson([], 'out');
            }
            throw e;
        }
    },

    /**
     * Transforms Jira transitions data into a format suitable for select/dropdown components.
     * @param {Object} result - The API response containing transitions
     * @param {Array} [result.transitions] - Array of transition objects
     * @returns {Array<{label: string, value: string}>} - Formatted array for select components
     */
    transitionsToSelectArray(result) {
        if (Array.isArray(result?.transitions)) {
            return result.transitions.map(item => ({ label: `${item.name} (ID:${item.id})`, value: item.id }));
        }
        return [];
    }
};

'use strict';

const commons = require('../../jira-commons');
const lib = require('../../lib.outputPortOptions');

const schema = {
    'id': { 'type': 'string', 'title': 'Id' },
    'name': { 'type': 'string', 'title': 'Name' },
    'to': {
        'type': 'object',
        'properties': {
            'self': { 'type': 'string', 'title': 'To.Self' },
            'description': { 'type': 'string', 'title': 'To.Description' },
            'iconUrl': { 'type': 'string', 'title': 'To.Icon Url' },
            'name': { 'type': 'string', 'title': 'To.Name' },
            'id': { 'type': 'string', 'title': 'To.Id' },
            'statusCategory': {
                'type': 'object',
                'properties': {
                    'self': { 'type': 'string', 'title': 'To.Status Category.Self' },
                    'id': { 'type': 'number', 'title': 'To.Status Category.Id' },
                    'key': { 'type': 'string', 'title': 'To.Status Category.Key' },
                    'colorName': { 'type': 'string', 'title': 'To.Status Category.Color Name' },
                    'name': { 'type': 'string', 'title': 'To.Status Category.Name' }
                },
                'title': 'To.Status Category'
            }
        },
        'title': 'To'
    },
    'hasScreen': { 'type': 'boolean', 'title': 'Has Screen' },
    'isGlobal': { 'type': 'boolean', 'title': 'Is Global' },
    'isInitial': { 'type': 'boolean', 'title': 'Is Initial' },
    'isAvailable': { 'type': 'boolean', 'title': 'Is Available' },
    'isConditional': { 'type': 'boolean', 'title': 'Is Conditional' },
    'isLooped': { 'type': 'boolean', 'title': 'Is Looped' }
};

module.exports = {

    async receive(context) {

        const { profileInfo, auth } = context;
        const { id, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, {
                label: 'Transitions',
                value: 'transitions'
            });
        }

        try {
            const transitions = await commons.get(`${profileInfo.apiUrl}issue/${id}/transitions`, auth);
            return lib.sendArrayOutput({
                context,
                records: transitions,
                outputType
            });
        } catch (e) {
            if (context.properties.variablesFetch) {
                return lib.sendArrayOutput({ context, records: transitions, outputType: 'array' });
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

'use strict';

const isValidType = (value, expectedType) => {
    switch (expectedType) {
        case 'number':
            // Check for both type 'number' and not NaN
            return typeof value === 'number' && !isNaN(value);
        case 'text':
        case 'textarea':
        case 'filepicker':
            // Check for type 'string'
            return typeof value === 'string';
        case 'date-time':
            // Check for a valid date; Date.parse returns NaN for invalid dates
            return typeof value === 'string' && !isNaN(Date.parse(value));
        case 'toggle':
            // Check for boolean type
            return typeof value === 'boolean';
        default:
            // Unexpected type, could log this or handle as needed
            return false;
    }
};


/**
 * OnStart component reacts to the 'start' message only. It triggers when the flow starts.
 * @extends {Component}
 */
module.exports = {

    /**
     * Handles the 'receive' event.
     *
     * @param {Context} context
     */
    receive(context) {

        // Extract variables from the message content
        const { variables: inputVariables } = context.messages.in.content;
        const variablesArray = inputVariables?.ADD || [];
        const outputObject = {};

        if (context.properties.generateOutputPortOptions) {
            return this.generateOutputPortOptions(context, variablesArray);
        }

        variablesArray.forEach(variable => {

            // type can be number, text, textarea, filepicker, date and toggle
            const { name, type, ...value } = variable;
            if (!isValidType(value[type], type)) {
                throw new context.CancelError(`Type mismatch for variable "${name}". Expected type: ${type}.`);
            }
            outputObject[name] = value[type];
        });
        // Send the output
        return context.sendJson(outputObject, 'out');
    },

    /**
     * Generates output port options based on input variables.
     *
     * @param {Context} context
     * @param {string} outputType
     */
    generateOutputPortOptions(context, variablesArray) {

        const options = [];
        variablesArray.forEach(variable => {
            const { name, type } = variable;
            options.push({
                label: name,
                value: name,
                type
            });
        });
        // Send the options as output
        return context.sendJson(options, 'out');
    }
};

'use strict';

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

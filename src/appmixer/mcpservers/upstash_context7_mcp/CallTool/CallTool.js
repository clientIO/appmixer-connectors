'use strict';

const lib = require('../lib');

module.exports = {

    receive: async function(context) {

        if (context.properties.generateInspector) {

            const inspector = await this.generateInspectorForToolInputSchema(context);
            return context.sendJson(inspector, 'out');
        }
        const result = await lib.mcpCall(
            context,
            context.auth,
            'callTool',
            [{
                name: context.properties.tool,
                arguments: context.messages.in.content
            }]
        );
        const text = result?.content?.[0]?.text;
        const output = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
        return context.sendJson({ output }, 'out');
    },

    generateInspectorForToolInputSchema: async function(context) {

        const result = await lib.mcpCall(context, context.auth, 'listTools', []);
        const tools = result.tools || [];

        const inputs = {};
        tools.forEach(tool => {
            if (tool.name === context.properties.tool && tool.inputSchema && tool.inputSchema.properties) {
                let index = 1;
                Object.keys(tool.inputSchema.properties).forEach(property => {
                    const propertySchema = tool.inputSchema.properties[property];
                    const inspectorType = ({
                        'string': 'text',
                        'number': 'number',
                        'boolean': 'toggle',
                        'array': 'text',
                        'object': 'text'
                    })[propertySchema.type] || 'text';

                    inputs[property] = {
                        type: inspectorType,
                        label: property,
                        tooltip: propertySchema.description,
                        defaultValue: propertySchema.default,
                        index: index++
                    };
                });
            }
        });
        return { inputs };
    }
};

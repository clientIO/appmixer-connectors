'use strict';
const { XMLBuilder } = require('fast-xml-parser');

function parseInputJSON(context, jsonString) {
    try {
        return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    } catch (e) {
        throw new context.CancelError(`The input JSON is invalid: ${jsonString}`);
    }
}

module.exports = {

    async receive(context) {

        const {
            json,
            arrayNodeName,
            attributeNamePrefix,
            attributesGroupName,
            cdataPropName,
            commentPropName,
            format,
            ignoreAttributes,
            indentBy,
            preserveOrder,
            processEntities,
            stopNodes,
            suppressBooleanAttributes,
            suppressEmptyNode,
            suppressUnpairedNode,
            textNodeName,
            unpairedTags
        } = context.messages.in.content;

        const options = {
            arrayNodeName,
            attributeNamePrefix,
            attributesGroupName,
            cdataPropName,
            commentPropName,
            format,
            ignoreAttributes,
            indentBy,
            preserveOrder,
            processEntities,
            stopNodes: (stopNodes || '').split(',').map(path => path.trim()),
            suppressBooleanAttributes,
            suppressEmptyNode,
            suppressUnpairedNode,
            textNodeName: textNodeName || '',
            unpairedTags: (unpairedTags || '').split(',').map(tag => tag.trim())
        };

        const builder = new XMLBuilder(options);

        const xml = builder.build(parseInputJSON(context, json));

        return context.sendJson({ xml }, 'out');
    }
};

'use strict';
const { XMLParser } = require('fast-xml-parser');

module.exports = {

    async receive(context) {

        const {
            xml,
            allowBooleanAttributes,
            alwaysCreateTextNode,
            attributesGroupName,
            attributeNamePrefix,
            cdataPropName,
            commentPropName,
            ignoreAttributes,
            ignoreDeclaration,
            ignorePiTags,
            alwaysArray,
            numberParseLeadingZeros,
            numberParseHex,
            numberParseSkipLike,
            parseAttributeValue,
            parseTagValue,
            preserveOrder,
            processEntities,
            removeNSPrefix,
            stopNodes,
            textNodeName,
            trimValues,
            unpairedTags
        } = context.messages.in.content;

        const options = {
            allowBooleanAttributes,
            alwaysCreateTextNode,
            attributesGroupName,
            attributeNamePrefix,
            cdataPropName,
            commentPropName,
            ignoreAttributes,
            ignoreDeclaration,
            ignorePiTags,
            isArray: (name, jpath, isLeafNode, isAttribute) => {
                return alwaysArray && alwaysArray.split(',').indexOf(jpath) !== -1;
            },
            numberParseOptions: {
                leadingZeros: numberParseLeadingZeros,
                hex: numberParseHex,
                skipLike: new RegExp(numberParseSkipLike)
            },
            parseAttributeValue,
            parseTagValue,
            preserveOrder,
            processEntities,
            removeNSPrefix,
            stopNodes: (stopNodes || '').split(',').map(path => path.trim()),
            textNodeName: textNodeName || '',
            trimValues,
            unpairedTags: (unpairedTags || '').split(',').map(tag => tag.trim())
        };

        const parser = new XMLParser(options);
        const json = parser.parse(xml);
        return context.sendJson({ json }, 'out');
    }
};

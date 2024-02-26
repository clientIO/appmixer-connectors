'use strict';
const XPath = require('xpath');
const DOMParser = require('xmldom').DOMParser;

module.exports = {

    async receive(context) {

        const { xml, xpath } = context.messages.in.content;

        const doc = new DOMParser().parseFromString(xml);
        const selected = XPath.select(xpath, doc);
        const result = Array.isArray(selected) ? selected.map(node => node.toString()).join('') : selected;
        return context.sendJson({ result }, 'out');
    }
};

'use strict';

const Parser = require('rss-parser');

module.exports = {

    async receive(context) {

        const { url } = context.messages.in.content;
        const parser = new Parser();
        const feed = await parser.parseURL(url);
        return context.sendJson({ feed } , 'out');
    }
};

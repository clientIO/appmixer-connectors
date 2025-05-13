const marked = require('marked');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

module.exports = {

    parseMD(context, mdContent = '') {
        let html;
        try {
            const window = new JSDOM('').window;
            const DOMPurify = createDOMPurify(window);
            html = DOMPurify.sanitize(marked.parse(mdContent));
        } catch (error) {
            context.log({ step: 'Error parsing Markdown in description', error: error });
            throw new context.CancelError('Error parsing Markdown in description');
        }
        return html;
    }
};

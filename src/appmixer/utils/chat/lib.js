const fs = require('fs');

const chatLibJs = fs.readFileSync(__dirname + '/chat.lib.js', 'utf8');
const chatLibCss = fs.readFileSync(__dirname + '/chat.lib.css', 'utf8');
const chatMainJs = fs.readFileSync(__dirname + '/chat.main.js', 'utf8');

const page = (endpoint, options) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
        <style type="text/css">${chatLibCss}</style>
        </head>
        <body>
        <div id="chat-container"></div>
        <script type="text/javascript">${chatLibJs}</script>
        <script type="text/javascript">
           const ENDPOINT = '${endpoint}';
           const OPTIONS = ${JSON.stringify(options)};
        </script>
        <script type="text/javascript">${chatMainJs}</script>
        </body>
        </html>
        `;
};

module.exports = {

    generateWebUI: function(endpoint, options) {
        return page(endpoint, options);
    }
};

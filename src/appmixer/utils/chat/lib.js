const fs = require('fs');
const { URL } = require('url');

/*
const chatLibJs = fs.readFileSync(__dirname + '/chat.lib.js', 'utf8');
const chatLibCss = fs.readFileSync(__dirname + '/chat.lib.css', 'utf8');
const chatMainJs = fs.readFileSync(__dirname + '/chat.main.js', 'utf8');
*/

const page = (baseUrl, endpoint) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
        <link rel="stylesheet" href="${baseUrl}/plugins/appmixer/utils/chat/assets/chat.lib.css"/>
        <link rel="stylesheet" href="${baseUrl}/plugins/appmixer/utils/chat/assets/chat.main.css"/>
        </head>
        <body>
        <div id="chat-container"></div>
        <div style="display: none" id="chat-waiting">waiting...</div>
        <script type="text/javascript" src="${baseUrl}/plugins/appmixer/utils/chat/assets/chat.lib.js"></script>
        <script type="text/javascript">
           const ENDPOINT = '${endpoint}';
        </script>
        <script type="text/javascript" src="${baseUrl}/plugins/appmixer/utils/chat/assets/chat.main.js"></script>
        </body>
        </html>
        `;
};

module.exports = {

    generateWebUI: function(endpoint) {
        const parsedUrl = new URL(endpoint);
        const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
        return page(baseUrl, endpoint);
    }
};

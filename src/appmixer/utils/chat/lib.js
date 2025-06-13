const { URL } = require('url');

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

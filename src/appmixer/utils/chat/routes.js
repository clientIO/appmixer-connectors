'use strict';

const fs = require('fs');

const chatLibJs = fs.readFileSync(__dirname + '/chat.lib.js', 'utf8');
const chatLibCss = fs.readFileSync(__dirname + '/chat.lib.css', 'utf8');

module.exports = (context) => {

    context.http.router.register({
        method: 'GET',
        path: '/assets/chat.lib.js',
        options: {
            handler: async (req, h) => {
                h.response(chatLibJs).type('text/javascript');
            }
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/assets/chat.lib.css',
        options: {
            handler: async (req, h) => {
                h.response(chatLibCss).type('text/css');
            }
        }
    });

};

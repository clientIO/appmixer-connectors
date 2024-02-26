'use strict';

const assets = require('./assets');

const formPage = (opt, content, type) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
        <style type="text/css">${assets.baseStylesheet}</style>
        <style type="text/css">${assets.stylesheet}</style>
        <style type="text/css">${opt.stylesheet || ''}</style>
        </head>
        <body class="${type}">
        <div id="header">
        <img class="logo" src="${opt.logo || assets.logo}"/>
        <h1>${opt.title || ''}</h1>
        </div>
        <div id="description">${opt.description || ''}</div>
        <div id="content">${content}</div>
        <div id="footer">
        <img class="logo" src="${opt.logo || assets.logo}"/>
        </div>
        <script type="text/javascript">${opt.script || ''}</script>
        </body>
        </thml>
        `;
};

module.exports = {

    generateWebFormPage: function(opt = {}, url) {

        let fieldsHTML = '';
        const fields = (opt && opt.fields && opt.fields.ADD) ? opt.fields.ADD : [];

        fields.sort((a, b) => {
            const aIndex = typeof a.index === 'number' ? a.index : Number.MAX_SAFE_INTEGER;
            const bIndex = typeof b.index === 'number' ? b.index : Number.MAX_SAFE_INTEGER;
            if (aIndex < bIndex) {
                return -1;
            }
            if (aIndex > bIndex) {
                return 1;
            }
            return 0;
        });

        fields.forEach((field, index) => {
            const name = 'field_' + index;
            fieldsHTML += `
                <div class="pure-control-group">
                <label for="${field.label}">${field.label}</label>
                <input id="${field.label}" name="${name}" type="${field.type}" value="${field.defaultValue || ''}" />
                <span class="pure-form-message">${field.description || ''}</span>
                </div>
                `;
        });
        const enctype = 'application/x-www-form-urlencoded';
        const content = `
              <form class="pure-form pure-form-stacked" action=${url} method="POST" enctype="${enctype}">
              <fieldset>${fieldsHTML}</fieldset>
              <button class="pure-button pure-button-primary" type="submit">${opt.cta || 'Submit'}</button>
              </form>
            `;
        return formPage(opt, content, 'form-page');
    },

    generateWebFormSuccessPage: function(opt = {}) {

        const content = `
              <h2 class="thanks-message">${opt.thanksMessage || 'Thank you!'}</h2>
              <img class="thanks-image" src="${opt.thanksImage || assets.successImageDataUri}"/>
              `;
        return formPage(opt, content, 'thank-you-page');
    }
};

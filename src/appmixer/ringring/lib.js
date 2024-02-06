'use strict';

module.exports = {

    jsonata: require('jsonata'),

    jsonPointer: require('json-pointer'),

    jmespath: require('jmespath'),

    FormData: require('form-data'),

    getBaseUrl: function(context) {

        let url = 'https://api.ringring.be';
        return url;
    },

    setProperty: function(obj, path, value) {

        if (!obj || typeof obj !== 'object' || !path) {
            throw new Error('Invalid input');
        }

        if (typeof value === 'undefined') return;

        const pathArray = Array.isArray(path) ? path : path.split('.');
        const pathLength = pathArray.length;

        for (let i = 0; i < pathLength - 1; i++) {
            const key = pathArray[i];
            if (!obj.hasOwnProperty(key) || typeof obj[key] !== 'object') {
                obj[key] = {};
            }
            obj = obj[key];
        }

        obj[pathArray[pathLength - 1]] = value;
    },

    setProperties: function(obj, mapping) {

        Object.keys(mapping || {}).forEach(path => {
            this.setProperty(obj, path, mapping[path]);
        });
    },

    replaceRuntimeExpressions: async function(template, context, response, request) {

        if (template === '$request.body') {
            return request.data;
        }

        let result = typeof template === 'string' ? template : JSON.stringify(template);

        result = result.replace(/{\$webhookUrl}/g, context.getWebhookUrl());
        result = result.replace(/{\$baseUrl}/g, this.getBaseUrl(context));

        result = result.replace(/{\$response.body#([^}]*)}/g, (match, pointer) => {
            return this.jsonPointer.get(response.data, pointer);
        });

        result = result.replace(/{\$parameters\.([^}]*)}/g, (match, pointer) => {
            return this.jsonPointer.get(context.properties, '/' + pointer);
        });

        result = result.replace(/{\$connection.profile\.([^}]*)}/g, (match, pointer) => {
            return this.jsonPointer.get(context.auth.profileInfo, '/' + pointer);
        });
        result = result.replace(/{\$connection.profile#([^}]*)}/g, (match, pointer) => {
            return this.jsonPointer.get(context.auth.profileInfo, pointer);
        });

        const responseTransformPromises = [];
        const responseTransformRegex = /{\$response.transform#(.*(?<!\\))}/g;
        result.replace(responseTransformRegex, (match, exp) => {
            const expression = this.jsonata(exp);
            responseTransformPromises.push(expression.evaluate(response));
        });
        const replacements = await Promise.all(responseTransformPromises);
        result = result.replace(responseTransformRegex, () => replacements.shift());

        result = result.replace(/{\$response.header\.([^}]*)}/g, (match, pointer) => {
            return this.jsonPointer.get(response.headers, '/' + pointer);
        });

        return typeof template === 'string' ? result : JSON.parse(result);
    }

};

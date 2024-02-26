'use strict';

const jsonPointer = require('json-pointer');

module.exports = {

    async receive(context) {

        if (context.messages.webhook) {
            await context.sendJson(context.messages.webhook.content, 'request');
            if (context.properties.immediateResponse) {
                return context.response(context.messages.webhook.content.data);
            }
            return;
        }

        return context.response(context.messages.response.content);
    },

    async start(context) {

        const {
            onStartRequestUrl,
            onStartRequestMethod,
            onStartRequestHeaders,
            onStartRequestBody
        } = context.properties;

        const response = await context.httpRequest({
            url: onStartRequestUrl,
            method: onStartRequestMethod,
            headers: JSON.parse(onStartRequestHeaders),
            data: JSON.parse(onStartRequestBody)
        });
        return context.saveState({ response: { data: response.data, headers: response.headers } });
    },

    async stop(context) {

        let { onStopRequestUrl, onStopRequestMethod, onStopRequestHeaders, onStopRequestBody } = context.properties;

        const response = context.state.response;

        onStopRequestUrl = replaceRuntimeExpressions(onStopRequestUrl, response);
        onStopRequestMethod = replaceRuntimeExpressions(onStopRequestMethod, response);
        onStopRequestHeaders = replaceRuntimeExpressions(onStopRequestHeaders, response);
        onStopRequestBody = replaceRuntimeExpressions(onStopRequestBody, response);

        return context.httpRequest({
            url: onStopRequestUrl,
            method: onStopRequestMethod,
            headers: JSON.parse(onStopRequestHeaders),
            data: JSON.parse(onStopRequestBody)
        });
    }
};


// See Runtime Expressions of OpenAPI Spec 3: https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#runtimeExpression.
// We support $response.body and $response.header only as that makes mose sense in our scenario.
const replaceRuntimeExpressions = (template, response) => {

    let result = template.replace(/{\$response.body#([^}]*)}/g, (match, pointer) => {
        return jsonPointer.get(response.data, pointer);
    });

    result = result.replace(/{\$response.header\.([^}]*)}/g, (match, pointer) => {
        return jsonPointer.get(response.headers, '/' + pointer);
    });

    return result;
};

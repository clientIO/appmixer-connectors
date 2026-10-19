'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const {
            sessionId,
            windowId,
            elementDescription,
            clickType,
            waitForNavigation,
            costThresholdCredits,
            timeThresholdSeconds
        } = context.messages.in.content;

        if (!sessionId) {
            throw new context.CancelError('Session ID is required!');
        }
        if (!windowId) {
            throw new context.CancelError('Window ID is required!');
        }
        if (!elementDescription) {
            throw new context.CancelError('Element Description is required!');
        }

        const payload = { elementDescription };

        if (waitForNavigation) {
            payload.waitForNavigation = true;
        }
        if (clickType && clickType !== 'click') {
            payload.configuration = { clickType };
        }
        lib.applyThresholds(context, payload, { costThresholdCredits, timeThresholdSeconds });

        const { data } = await lib.apiRequest(context, {
            method: 'POST',
            path: `/sessions/${encodeURIComponent(sessionId)}/windows/${encodeURIComponent(windowId)}/click`,
            data: payload
        });

        const result = lib.aiResult(context, data);

        return context.sendJson({
            modelResponse: result.modelResponse,
            status: result.status,
            requestId: result.requestId,
            credits: result.credits
        }, 'out');
    }
};

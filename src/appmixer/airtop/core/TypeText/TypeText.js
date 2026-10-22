'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const {
            sessionId,
            windowId,
            text,
            elementDescription,
            pressEnterKey,
            clearInputField,
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
        if (!text) {
            throw new context.CancelError('Text is required!');
        }

        const payload = { text };

        if (elementDescription) {
            payload.elementDescription = elementDescription;
        }
        if (pressEnterKey) {
            payload.pressEnterKey = true;
        }
        if (clearInputField) {
            payload.clearInputField = true;
        }
        if (waitForNavigation) {
            payload.waitForNavigation = true;
        }
        lib.applyThresholds(context, payload, { costThresholdCredits, timeThresholdSeconds });

        const { data } = await lib.apiRequest(context, {
            method: 'POST',
            path: `/sessions/${encodeURIComponent(sessionId)}/windows/${encodeURIComponent(windowId)}/type`,
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

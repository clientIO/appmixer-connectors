'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { keyResultId, name, note, stepsCurrent, stepsStart, stepsEnd, unit } = context.messages.in.content;
        if (!keyResultId) {
            throw new context.CancelError('Key Result ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const body = {};
        if (name !== undefined) body.name = name;
        if (note !== undefined) body.note = note;
        if (stepsCurrent !== undefined) body.steps_current = stepsCurrent;
        if (stepsStart !== undefined) body.steps_start = stepsStart;
        if (stepsEnd !== undefined) body.steps_end = stepsEnd;
        if (unit !== undefined) body.unit = unit;

        await clickUpClient.request('PUT', `/key_result/${keyResultId}`, { data: body });

        return context.sendJson({}, 'out');
    }
};

'use strict';

module.exports = {
    async receive(context) {

        // https://developers.pinterest.com/docs/api/v5/pins-list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.pinterest.com/v5/pins',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson(data.items, 'out');
    },

    pinsToSelectArray(pins) {
        if (!Array.isArray(pins)) return [];
        return pins.map(pin => ({
            label: pin.name || 'Unnamed Pin',
            value: pin.id || ''
        }));
    }
};

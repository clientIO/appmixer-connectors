'use strict';
const weather = require('../weather-commons');

module.exports = {

    receive(context) {

        let { city, coordinates, units = 'standard' } = context.messages.location.content;

        let qs = {};
        if (city) {
            qs.q = city;
        } else if (coordinates) {
            qs.lat = coordinates.split(',')[0].trim();
            qs.lon = coordinates.split(',')[1].trim();
        }
        if (units) {
            qs.units = units;
        }

        return weather.get('/weather', qs, context.auth.apiKey)
            .then(body => {
                body.weather = (body.weather || []).map(item => {
                    item.iconUrl = 'http://openweathermap.org/img/w/' + item.icon + '.png';
                    return item;
                });
                return context.sendJson(body, 'weather');
            });
    }
};

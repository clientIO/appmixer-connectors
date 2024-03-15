'use strict';
const weather = require('../weather-commons');

function response2output(res) {

    let out = {
        city: res.city
    };

    const periods = [
        '3h', '6h', '9h', '12h', '15h', '18h', '21h', '1d',
        '1d3h', '1d6h', '1d9h', '1d12h', '1d15h', '1d18h', '1d21h', '2d',
        '2d3h', '2d6h', '2d9h', '2d12h', '2d15h', '2d18h', '2d21h', '3d',
        '3d3h', '3d6h', '3d9h', '3d12h', '3d15h', '3d18h', '3d21h', '4d',
        '4d3h', '4d6h', '4d9h', '4d12h', '4d15h', '4d18h', '4d21h', '5d'
    ];

    res.list.forEach((item, idx) => {
        if (periods[idx]) {
            item.weather = item.weather.map(w => {
                w.iconUrl = 'http://openweathermap.org/img/w/' + w.icon + '.png';
                return w;
            });
            out[periods[idx]] = item;
        }
    });

    return out;
}

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

        return weather.get('/forecast', qs, context.auth.apiKey)
            .then(body => {
                return context.sendJson(response2output(body), 'weather');
            });
    }
};


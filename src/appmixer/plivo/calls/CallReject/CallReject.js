'use strict';
const Plivo = require('plivo');

module.exports = {

    receive(context) {

        const response = Plivo.Response();
        response.addHangup({ reason: 'rejected' });
        return context.response(response.toXML(), 200, { 'Content-Type': 'text/xml' });
    }
};

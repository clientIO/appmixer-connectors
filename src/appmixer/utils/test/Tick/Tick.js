'use strict';

module.exports = {

    async tick(context) {

        return context.sendJson({ time: new Date() }, 'out');
    }
};

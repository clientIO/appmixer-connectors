'use strict';

module.exports = {

    async receive(context) {

        return context.stopFlow();
    }
};

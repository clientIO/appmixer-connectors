'use strict';

const { processEntityCDC } = require('../../commons');

module.exports = {

    async tick(context) {

        await processEntityCDC(context, 'Invoice', 'updated');
    }
};

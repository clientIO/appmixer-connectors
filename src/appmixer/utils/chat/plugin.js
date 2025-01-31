'use strict';

module.exports = async context => {

    context.log('info', '[UTILS.CHAT] Initializing CHAT plugin.');
    require('./routes')(context);
    context.log('info', '[UTILS.CHAT] CHAT plugin initialized.');
};

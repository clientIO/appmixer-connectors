'use strict';

module.exports = async context => {
    context.log('info', '[CloudFlare] Initializing CloudFlare plugin.');
    await require('./routes')(context);

    context.log('info', '[CloudFlare] Scheduling CloudFlare jobs.');
    await require('./jobs')(context);

    context.log('info', '[CloudFlare] CloudFlare plugin initialized.');
};

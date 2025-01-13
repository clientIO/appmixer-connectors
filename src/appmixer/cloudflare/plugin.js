'use strict';

module.exports = async context => {
    await require('./routes')(context);
    await require('./jobs')(context);
    context.log('info', '[CloudFlare Lists] CloudFlare plugin successfully initialized.');
};

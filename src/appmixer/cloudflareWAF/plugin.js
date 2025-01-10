'use strict';

module.exports = async context => {
    await require('./routes')(context);
    await require('./jobs')(context);
    context.log('info', '[CloudFlare WAF] CloudFlare WAF plugin successfully initialized.');
};

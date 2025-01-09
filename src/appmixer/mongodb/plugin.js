'use strict';

module.exports = async context => {
    context.log('info', '[MongoDB] Initializing MongoDB plugin.');

    context.log('info', '[MongoDB] Scheduling MongoDB jobs.');
    await require('./jobs')(context);

    context.log('info', '[MongoDB] MongoDB plugin initialized.');
};

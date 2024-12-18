'use strict';

module.exports = async (context) => {
    context.log('info', '[MongoDB] Initializing MongoDB plugin.');

    require('./jobs')(context);

    context.log('info', '[MongoDB] MongoDB plugin initialized.');
};

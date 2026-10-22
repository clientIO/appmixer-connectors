'use strict';

module.exports = async context => {

    context.log('info', '[AI.MCPTOOLS] Initializing plugin.');
    require('./routes')(context);
    context.log('info', '[AI.MCPTOOLS] Plugin initialized.');
};

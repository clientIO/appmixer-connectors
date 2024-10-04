'use strict';

module.exports = async context => {
    context.log('info', '[RABBITMQ] Initializing plugin.');

    require('./routes')(context);

    context.log('info', '[RABBITMQ] Scheduling jobs.');
    await require('./jobs')(context);

    context.log('info', '[RABBITMQ] Plugin initialized.');
};

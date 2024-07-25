'use strict';

module.exports = async context => {
    context.log('info', '[KAFKA] Initializing Kafka plugin.');

    require('./routes')(context);

    context.log('info', '[KAFKA] Scheduling Kafka jobs.');
    await require('./jobs')(context);

    context.log('info', '[KAFKA] Kafka plugin initialized.');
};

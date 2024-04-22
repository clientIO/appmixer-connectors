'use strict';

module.exports = async context => {
    context.log('info', 'Initializing Kafka plugin.');

    require('./routes')(context);

    context.log('info', 'Scheduling Kafka jobs.');
    await require('./jobs')(context);

    context.log('info', 'Kafka plugin initialized.');
};

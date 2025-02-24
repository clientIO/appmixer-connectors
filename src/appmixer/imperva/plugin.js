'use strict';

module.exports = async context => {
    context.log('info', '[IMPERVA] Initializing Imperva plugin.');
    await require('./routes')(context);

    context.log('info', '[IMPERVA] Scheduling Imperva jobs.');
    await require('./jobs')(context);

    context.log('info', '[IMPERVA] Imperva plugin initialized.');
};

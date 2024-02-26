'use strict';

module.exports = async context => {

    context.log('info', 'Initializing PeopleTasks plugin.');

    // the plugin will be loaded on all nodes in the cluster. Only one node can perform that init
    const lock = await context.lock('people-tasks-init');

    let secret;
    try {
        secret = await context.service.stateGet('secret');
        if (!secret) {
            // migrate old documents into new collections
            context.log('info', 'Running PeopleTasks migrations.');
            await require('./migrations')(context);

            // define indexes
            await require('./TaskModel')(context).createIndex({ status: 1 });
            await require('./TaskModel')(context).createIndex({ status: 1, decisionBy: 1 });
            await require('./WebhookModel')(context).createIndex({ status: 1 });

            secret = require('crypto').randomBytes(128).toString('base64');
            await context.service.stateSet('secret', secret);
        }
    } finally {
        lock.unlock();
    }

    context.log('info', 'Loading PeopleTasks API.');
    require('./routes')(context, { secret });
    context.log('info', 'Scheduling PeopleTasks jobs.');
    await require('./jobs')(context);
    context.log('info', 'PeopleTasks plugin initialized.');
};


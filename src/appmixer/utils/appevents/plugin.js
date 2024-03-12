'use strict';

module.exports = async context => {

    context.log('info', 'Initializing App Events plugin.');

    // the plugin will be loaded on all nodes in the cluster. Only one node can perform that init
    const lock = await context.lock('app-events-init');

    try {
        await require('./AppEventTriggerModel')(context).createIndex({ userId: 1, event: 1, flowId: 1 });
    } finally {
        lock.unlock();
    }

    require('./routes')(context);

    context.log('info', 'App Events plugin initialized.');
};

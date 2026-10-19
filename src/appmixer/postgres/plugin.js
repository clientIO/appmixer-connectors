'use strict';

module.exports = async context => {

    context.log('info', '[PG_ASYNC] Initializing PostgreSQL plugin (async query support).');

    await require('./jobs')(context);

    context.log('info', '[PG_ASYNC] PostgreSQL plugin initialized.');
};

'use strict';

module.exports = (context, options) => {

    const IPListModel = require('./IPListModel')(context);

    context.http.router.register({
        method: 'POST', path: '/ip-list', options: {
            handler: async req => {

                const items = req.payload.items;
                const operations = items.map(item => ({
                    updateOne: {
                        filter: { id: item.id }, update: { $set: item }, upsert: true
                    }
                }));
                return await (context.db.collection(IPListModel.collection)).bulkWrite(operations);
            }
        }
    });

    context.http.router.register({
        method: 'GET', path: '/ip-list', options: {
            handler: async req => {
                return IPListModel.find({});
            }
        }
    });
};

'use strict';
const uuid = require('uuid');

const addIdProperty = async (context, collectionName, propertyName) => {

    const collection = context.db.coreCollection(collectionName);
    const cursor = collection.find({}).project({ _id: 1 });
    while (await cursor.hasNext()) {
        const doc = await cursor.next();
        const id = uuid.v4();
        // eslint-disable-next-line no-underscore-dangle
        await collection.updateOne({ _id: doc._id }, { $set: { [propertyName]: id } });
    }
    await cursor.close();
};

const migrateTasks = async context => {

    const legacyCollectionName = 'peopleTaskTasks';
    const newCollectionName = 'pluginAppmixerUtilsTasksTasks';
    context.log('info', `Migrating legacy ${legacyCollectionName}`);
    const legacyCollection = context.db.coreCollection(legacyCollectionName);
    const count = await legacyCollection.countDocuments({});
    if (count) {
        await legacyCollection.aggregate([{ $out: newCollectionName }]).toArray();
        await legacyCollection.drop();
        context.log('info', `Migration from ${legacyCollectionName} to ${newCollectionName} completed successfully.`);
        await addIdProperty(context, newCollectionName, 'taskId');
    }
};

const migrateWebhooks = async context => {

    const legacyCollectionName = 'peopleTaskWebhooks';
    const newCollectionName = 'pluginAppmixerUtilsTasksWebhooks';
    context.log('info', `Migrating legacy ${legacyCollectionName}`);
    const legacyCollection = context.db.coreCollection(legacyCollectionName);
    const count = await legacyCollection.countDocuments({});
    if (count) {
        // tasks will already be migrated, so we can just update the webhooks.
        // update existing taskId of webhook to new taskId from tasks
        await legacyCollection.aggregate([
            // cast webhook's legacy taskId from string to objectId so that it works with lookup
            {
                $addFields: { taskId: { $toObjectId: '$taskId' } }
            },
            // populate related task as task property
            {
                $lookup: {
                    from: 'pluginAppmixerUtilsTasksTasks',
                    localField: 'taskId', // field in the webhook collection
                    foreignField: '_id', // field in the tasks collection
                    as: 'task' // project as task property, lookup resolves task property as an array
                }
            },
            // change task property from array to object as webhook.task, keep webhook record even if no task found
            { $unwind: { path: '$task', preserveNullAndEmptyArrays: true } },
            // update webhook taskId to taskId from task record
            {
                $addFields: { taskId: '$task.taskId' }
            },
            // remove task property
            { $project: { task: 0 } },
            // output results to collection
            { $out: newCollectionName }
        ]).toArray();
        await legacyCollection.drop();
        context.log('info', `Migration from ${legacyCollectionName} to ${newCollectionName} completed successfully.`);
        await addIdProperty(context, newCollectionName, 'webhookId');
    }
};

module.exports = async context => {

    await migrateTasks(context);
    await migrateWebhooks(context);
};

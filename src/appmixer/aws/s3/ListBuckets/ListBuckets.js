'use strict';
const commons = require('../../aws-commons');

/**
 * List all buckets.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const sendWholeArray = context.properties?.sendWholeArray || false;
        const generateOutputPortOptions = context.properties?.generateOutputPortOptions || false;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, sendWholeArray);
        }

        const { s3 } = commons.init(context);
        const { Buckets } = await s3.listBuckets().promise();

        if (sendWholeArray) {
            return context.sendJson({ Buckets }, 'bucket');
        } else {
            const promises = Buckets.map(bucket => context.sendJson(bucket, 'bucket'));
            return Promise.all(promises);
        }
    },

    bucketsToSelectArray(data) {
        const buckets = data.Buckets || []; // Extract the array from the object
        if (Array.isArray(buckets)) {
            return buckets.map(bucket => ({
                label: bucket.Name,
                value: bucket.Name
            }));
        }
        return [];
    },

    getOutputPortOptions(context, sendWholeArray) {

        if (sendWholeArray === false) {
            return context.sendJson(
                [
                    { label: 'Name', value: 'Name' },
                    { label: 'CreationDate', value: 'CreationDate' }
                ],
                'bucket'
            );
        } else {
            return context.sendJson(
                [
                    {
                        label: 'Buckets', value: 'Buckets',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    Name: { type: 'string', title: 'Name' },
                                    CreationDate: { type: 'string', title: 'CreationDate' }
                                }
                            }
                        }
                    }
                ],
                'bucket'
            );
        }
    }
};

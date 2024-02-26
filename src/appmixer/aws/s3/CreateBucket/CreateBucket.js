'use strict';
const commons = require('../../aws-commons');

/**
 * Creates bucket.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { region } = context.properties;
        const { name, acl, lockEnabled, versionEnabled } = context.messages.in.content;
        const { s3 } = commons.init(context);

        const { Location } = await s3.createBucket({
            Bucket: name,
            ACL: acl,
            CreateBucketConfiguration: {
                LocationConstraint: region || 'us-east-1'
            },
            ObjectLockEnabledForBucket: lockEnabled
        }).promise();

        await s3.putBucketVersioning({
            Bucket: name,
            VersioningConfiguration: {
                Status: versionEnabled ? 'Enabled' : 'Suspended'
            }
        }).promise();

        return context.sendJson({ Name: name, Location }, 'bucket');
    }
};

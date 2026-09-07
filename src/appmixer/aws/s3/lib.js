'use strict';

const { S3Client, GetBucketNotificationConfigurationCommand, PutBucketNotificationConfigurationCommand, ListBucketsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { SNSClient, CreateTopicCommand, SetTopicAttributesCommand, SubscribeCommand, UnsubscribeCommand, DeleteTopicCommand, ConfirmSubscriptionCommand } = require('@aws-sdk/client-sns');
const { KMSClient, DescribeKeyCommand, ListKeyPoliciesCommand, GetKeyPolicyCommand } = require('@aws-sdk/client-kms');
const crypto = require('crypto');

module.exports = {

    init(context) {

        const region = context.messages.in?.content?.region || context.properties.region || 'us-east-1';

        const { accessKeyId, secretKey } = context.auth;
        const credentials = {
            accessKeyId,
            secretAccessKey: secretKey
        };

        const s3 = new S3Client({ region, credentials });
        const sns = new SNSClient({ region, credentials });
        const kms = new KMSClient({ region, credentials });

        return {
            s3,
            sns,
            kms,
            region
        };
    },

    /**
     * List all buckets for the configured account/region. Shared by the NewBucket /
     * DeletedBucket polling triggers (tick + test) so they all fetch buckets the same way.
     * @param {Context} context
     * @return {Promise<Array>} array of raw bucket objects ({ Name, CreationDate, ... })
     */
    async listBuckets(context) {

        const { s3, region } = this.init(context);
        try {
            const response = await s3.send(new ListBucketsCommand({ BucketRegion: region }));
            return response.Buckets || [];
        } catch (error) {
            // Re-throw with just the error message. Otherwise a
            // [unable to serialize, circular reference is too complex to analyze]
            // error is thrown.
            throw new Error(error.message);
        }
    },

    /**
     * Find the most-recently-modified object in the configured bucket and reshape it into the
     * exact S3 event-notification `object` record that the NewObject / UpdatedObject triggers
     * emit from `receive()` (`{ key, size, eTag }`). Read-only (listObjectsV2 only) — used by
     * the triggers' test() methods to produce realistic Flow Test Mode data without a real event.
     * @param {Context} context
     * @return {Promise<Object|null>} S3-event-shaped object record, or null if the bucket is empty
     */
    async fetchLatestObject(context) {

        const { bucket } = context.properties;
        const { s3 } = this.init(context);

        let latest = null;
        let continuationToken;
        // ListObjectsV2 returns no ordering guarantee, so scan pages and keep the newest. Cap the
        // scan at MAX_PAGES: test() only needs a representative recent object, and scanning an entire
        // large bucket would make Flow Test Mode slow/expensive and risk execution timeouts.
        const MAX_PAGES = 10;
        let pagesScanned = 0;
        do {
            const response = await s3.send(new ListObjectsV2Command({
                Bucket: bucket,
                ContinuationToken: continuationToken
            }));
            const contents = response.Contents || [];
            for (const item of contents) {
                if (!latest || new Date(item.LastModified) > new Date(latest.LastModified)) {
                    latest = item;
                }
            }
            pagesScanned += 1;
            continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
        } while (continuationToken && pagesScanned < MAX_PAGES);

        if (!latest) {
            return null;
        }

        // Reshape into the S3 event-notification object record (same keys S3 puts on the wire).
        // eTag in S3 events is unquoted; ListObjectsV2 returns it quoted.
        return {
            key: latest.Key,
            size: latest.Size,
            eTag: typeof latest.ETag === 'string' ? latest.ETag.replace(/^"|"$/g, '') : latest.ETag
        };
    },

    /**
     * Process items to find newly added.
     * @param {Set} knownItems
     * @param {Set} actualItems
     * @param {Set} newItems
     * @param {String} key
     * @param {Object} item
     */
    processItems(knownItems, actualItems, newItems, key, item) {

        if (knownItems && !knownItems.has(item[key])) {
            newItems.add(item);
        }
        actualItems.add(item[key]);
    },

    /**
     * Create and subscribe topic to AWS SNS.
     * @param {Context} context
     * @param {Object} payload
     * @param {string} payload.topicPrefix
     * @param {string} payload.eventPrefix
     * @param {string} payload.eventType
     * @param {string} [payload.kmsMasterKeyId]
     * @param {string|string[]} [payload.trustedAccountIds]
     * @return {Promise}
     */
    async registerWebhook(context, payload) {

        await this.unregisterWebhook(context);

        const { sns, s3, kms } = this.init(context);

        const { bucket } = context.properties;
        const url = context.getWebhookUrl();

        let topicARN;

        let lock;
        try {
            lock = await context.lock(context.auth.userId.toString(), {
                ttl: 1000 * 60,
                retryDelay: 500,
                maxRetryCount: 60
            });

            const notificationConfig = await s3.send(
                new GetBucketNotificationConfigurationCommand({ Bucket: bucket })
            );
            const TopicConfigurations = notificationConfig.TopicConfigurations || [];
            const filteredTopics = TopicConfigurations.filter(
                topic => topic.TopicArn.includes(payload.topicPrefix)
            );

            if (filteredTopics.length > 0) {
                topicARN = filteredTopics[0].TopicArn;

                const state = await context.loadState();
                state.notificationInBucket = true;
                await context.saveState(state);
            } else {
                // Build createTopic params with optional encryption (backwards compatible).
                const createParams = {
                    Name: `${payload.topicPrefix}${crypto.randomBytes(10).toString('hex')}`
                };

                if (payload.kmsMasterKeyId) {
                    // --- KMS VALIDATION START ---
                    // Let the user know early if the key is invalid or not accessible.
                    const kmsMasterKeyId = payload.kmsMasterKeyId.trim();

                    // Soft format check (KeyId/UUID, ARN key, ARN alias, alias name, raw key id)
                    // eslint-disable-next-line max-len
                    const reKeyArn = /^arn:aws:kms:[a-z0-9-]+:\d{12}:key\/([0-9a-fA-F-]{36}|mrk-[A-Za-z0-9-]{8,})$/;
                    // eslint-disable-next-line max-len
                    const reAliasArn = /^arn:aws:kms:[a-z0-9-]+:\d{12}:alias\/[A-Za-z0-9/_+=,.@-]{1,256}$/;
                    const reAlias = /^alias\/[A-Za-z0-9/_+=,.@-]{1,256}$/;
                    const reKeyId = /^(?:[0-9a-fA-F-]{36}|mrk-[A-Za-z0-9-]{8,})$/; // UUID or mrk- key id
                    if (!(reKeyArn.test(kmsMasterKeyId) ||
                        reAliasArn.test(kmsMasterKeyId) ||
                        reAlias.test(kmsMasterKeyId) ||
                        reKeyId.test(kmsMasterKeyId))) {
                        throw new context.CancelError(
                            'kmsMasterKeyId format is invalid. ' +
                            'Must be a KMS key ARN, alias ARN, alias/<name>, or key UUID.'
                        );
                    }

                    // AWS describeKey to ensure existence / accessibility.
                    let keyMetadata;
                    try {
                        const describeKeyResponse = await kms.send(
                            new DescribeKeyCommand({ KeyId: kmsMasterKeyId })
                        );
                        keyMetadata = describeKeyResponse.KeyMetadata;
                    } catch (e) {
                        context.log({ step: 'kmsDescribeKeyError', error: e.message });
                        throw new context.CancelError('KMS key not found or not accessible.');
                    }

                    // Obtain key policy (default). Ensure S3 service allowed to decrypt & generate
                    // data keys.
                    try {
                        const keyId = keyMetadata.KeyId;
                        const listPoliciesResponse = await kms.send(
                            new ListKeyPoliciesCommand({ KeyId: keyId })
                        );
                        const PolicyNames = listPoliciesResponse.PolicyNames;
                        const policyName = PolicyNames.includes('default')
                            ? 'default'
                            : (PolicyNames[0] || 'default');
                        const getPolicyResponse = await kms.send(new GetKeyPolicyCommand({
                            KeyId: keyId,
                            PolicyName: policyName
                        }));
                        const Policy = getPolicyResponse.Policy;
                        let policyJson;
                        try {
                            policyJson = JSON.parse(Policy);
                        } catch (parseErr) {
                            throw new context.CancelError('Unable to parse KMS key policy JSON.');
                        }
                        const statements = Array.isArray(policyJson.Statement)
                            ? policyJson.Statement
                            : [policyJson.Statement];
                        const hasS3Statement = statements.some(stmt => {
                            if (!stmt || stmt.Effect !== 'Allow') return false;
                            // Principal can be structure like { Service: 's3.amazonaws.com' }
                            // or { AWS: 'arn:...' } or arrays.
                            let principalService = null;
                            if (stmt.Principal) {
                                if (typeof stmt.Principal.Service === 'string') {
                                    principalService = stmt.Principal.Service;
                                } else if (Array.isArray(stmt.Principal.Service)) {
                                    principalService = stmt.Principal.Service.find(
                                        s => s === 's3.amazonaws.com'
                                    ) || null;
                                }
                            }
                            const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
                            const serviceMatch = principalService === 's3.amazonaws.com';
                            const decryptOk = actions.includes('kms:Decrypt');
                            const dataKeyOk = actions.includes('kms:GenerateDataKey*') ||
                                actions.includes('kms:GenerateDataKey');
                            const resourceOk = !stmt.Resource || stmt.Resource === '*' || (
                                Array.isArray(stmt.Resource) && stmt.Resource.includes('*')
                            );
                            return serviceMatch && decryptOk && dataKeyOk && resourceOk;
                        });
                        if (!hasS3Statement) {
                            throw new context.CancelError(
                                'KMS key policy missing required S3 permissions ' +
                                '(kms:Decrypt, kms:GenerateDataKey* for Principal Service ' +
                                's3.amazonaws.com).'
                            );
                        }
                    } catch (e) {
                        if (e instanceof context.CancelError) throw e; // rethrow validation errors
                        context.log({ step: 'kmsPolicyValidationError', error: e.message });
                        throw new context.CancelError('Failed to validate KMS key policy.');
                    }
                    // --- KMS VALIDATION END ---

                    createParams.Attributes = {
                        KmsMasterKeyId: kmsMasterKeyId
                    };
                }

                const createTopicResponse = await sns.send(new CreateTopicCommand(createParams));
                topicARN = createTopicResponse.TopicArn;

                // If trusted account IDs provided, build restrictive policy. Otherwise keep
                // legacy public policy for backwards compatibility.
                // trustedAccountIds can be string (comma separated) or array of account IDs / ARNs.
                const { trustedAccountIds } = payload;
                let policy;
                if (trustedAccountIds && (
                    Array.isArray(trustedAccountIds) || typeof trustedAccountIds === 'string'
                )) {
                    let accounts = Array.isArray(trustedAccountIds)
                        ? trustedAccountIds
                        : trustedAccountIds.split(',');
                    accounts = accounts.map(a => a.trim()).filter(Boolean).map(a => {
                        // Normalize to full root ARN if just the numeric account id provided.
                        if (/^\d{12}$/.test(a)) {
                            return `arn:aws:iam::${a}:root`;
                        }
                        return a; // Assume already ARN or role.
                    });
                    if (accounts.length > 0) {
                        const accountId = topicARN.split(':')[4];
                        policy = {
                            Version: '2008-10-17',
                            Id: `${topicARN}/SQSDefaultPolicy`,
                            Statement: [
                                {
                                    Sid: 'AllowTrustedAccounts',
                                    Effect: 'Allow',
                                    Principal: {
                                        AWS: accounts.length === 1 ? accounts[0] : accounts
                                    },
                                    Action: ['SNS:Publish', 'SNS:Subscribe', 'SNS:Receive'],
                                    Resource: topicARN
                                },
                                // Explicitly allow S3 to publish to the topic from the bucket
                                // (needed for bucket notifications) to avoid error: Invalid Argument:
                                // Unable to validate the following destination configurations.
                                {
                                    Sid: 'AllowS3BucketPublish',
                                    Effect: 'Allow',
                                    Principal: { Service: 's3.amazonaws.com' },
                                    Action: 'SNS:Publish',
                                    Resource: topicARN,
                                    Condition: {
                                        StringEquals: { 'aws:SourceAccount': accountId },
                                        ArnLike: { 'aws:SourceArn': `arn:aws:s3:*:*:${bucket}` }
                                    }
                                }
                            ]
                        };
                    }
                }

                if (!policy) {
                    // Legacy open policy for compatibility (previous behavior).
                    policy = {
                        Version: '2008-10-17',
                        Id: '__default_policy_ID',
                        Statement: [
                            {
                                Sid: '__console_pub_0',
                                Effect: 'Allow',
                                Principal: { AWS: '*' },
                                Action: 'SNS:Publish',
                                Resource: topicARN
                            },
                            {
                                Sid: '__console_sub_0',
                                Effect: 'Allow',
                                Principal: { AWS: '*' },
                                Action: ['SNS:Subscribe', 'SNS:Receive'],
                                Resource: topicARN
                            }
                        ]
                    };
                }

                await sns.send(new SetTopicAttributesCommand({
                    TopicArn: topicARN,
                    AttributeName: 'Policy',
                    AttributeValue: JSON.stringify(policy)
                }));

                const topicConfigurations = TopicConfigurations.filter(topic => {
                    const events = topic.Events.filter(arr => !arr.includes(payload.eventPrefix));
                    return events.length > 0;
                });

                topicConfigurations.push({
                    TopicArn: topicARN,
                    Events: [
                        payload.eventType
                    ]
                });

                await s3.send(new PutBucketNotificationConfigurationCommand({
                    Bucket: bucket,
                    NotificationConfiguration: {
                        TopicConfigurations: topicConfigurations
                    }
                }));
            }
        } finally {
            await lock?.unlock();
        }

        return sns.send(new SubscribeCommand({
            TopicArn: topicARN,
            Protocol: 'https',
            Endpoint: url
        }));
    },

    /**
     * Delete registered notification and topicARN. If there is no topicARN in state, do nothing.
     * @param {Context} context
     * @return {Promise}
     */
    async unregisterWebhook(context) {

        const { topicARN, subscriptionArn, notificationInBucket } = await context.loadState();
        if (!topicARN || !subscriptionArn) {
            return Promise.resolve();
        }

        const { bucket } = context.properties;
        const { s3, sns } = this.init(context);

        let promises = [
            sns.send(new UnsubscribeCommand({ SubscriptionArn: subscriptionArn }))
        ];
        if (!notificationInBucket) {

            let lock;

            try {
                lock = await context.lock(context.auth.userId.toString(), {
                    ttl: 1000 * 60,
                    retryDelay: 500,
                    maxRetryCount: 60
                });

                const notificationConfig = await s3.send(
                    new GetBucketNotificationConfigurationCommand({ Bucket: bucket })
                );
                const TopicConfigurations = notificationConfig.TopicConfigurations || [];
                const filteredTopics = TopicConfigurations.filter(
                    topic => topic.TopicArn !== topicARN
                );
                await s3.send(new PutBucketNotificationConfigurationCommand({
                    Bucket: bucket,
                    NotificationConfiguration: {
                        TopicConfigurations: filteredTopics
                    }
                }));
            } finally {
                await lock?.unlock();
            }

            promises.push(sns.send(new DeleteTopicCommand({ TopicArn: topicARN })));
        }

        return Promise.all(promises);
    },

    /**
     * Verifies an endpoint owner's intent to receive messages by validating the token sent
     * to the endpoint.
     * @param {Context} context
     * @param {Object} payload
     * @return {Promise}
     */
    async confirmSubscription(context, payload) {

        const { sns } = this.init(context);

        const { TopicArn, Token } = payload;
        const confirmResponse = await sns.send(new ConfirmSubscriptionCommand({ TopicArn, Token }));
        const SubscriptionArn = confirmResponse.SubscriptionArn;

        const state = await context.loadState();
        state.topicARN = TopicArn;
        state.subscriptionArn = SubscriptionArn;
        await context.saveState(state);

        return context.response();
    },

    /**
     * There is no SDK method for getting object URL, but we can put it together.
     * @param {string} bucket
     * @param {string} key
     * @param {?string} [region]
     * @return {string}
     */
    getObjectUrl(bucket, key, region = null) {

        if (!region) {
            return `https://${bucket}.s3.amazonaws.com/${key}`;
        }
        return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    }
};

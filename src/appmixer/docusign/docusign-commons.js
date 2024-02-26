'use strict';
const docusign = require('docusign-esign');

const getAccessToken = async (integrationKey, secretKey, code, context) => {

    //set the combination of integration and secret key in a string
    let authorizationHeader = integrationKey + ':' + secretKey;
    //generate Buffer object to convert to base64 string\
    let buff = Buffer.from(authorizationHeader, 'utf8');
    //Convert data to base64 String
    authorizationHeader = 'Basic ' + buff.toString('base64');
    //Define headers with base64 String
    authorizationHeader = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: authorizationHeader
    };
    let { data: tokenResponse } = await context.httpRequest({
        url: 'https://account-d.docusign.com/oauth/token',
        method: 'POST',
        data: 'grant_type=authorization_code&code=' + code,
        headers: authorizationHeader
    });

    return tokenResponse;
};

const getEnvelope = async (args, accessToken) => {

    let dsApiClient = new docusign.ApiClient();
    dsApiClient.setBasePath(args.basePath + '/restapi/');
    dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + accessToken);
    let envelopesApi = new docusign.EnvelopesApi(dsApiClient);
    return await envelopesApi.getEnvelope(
        args.accountId,
        args.envelopeId,
        { include: args.include && args.include.join(',') }
    );
};

/**
 * Create and send envelope.
 * @param {Object} args
 * @param {String} args.basePath
 * @param {String} args.accountId
 * @param {Object} args.envelopeArgs
 * @param {Object} args.docs
 * @param {String} accessToken
 * @param {String} webhookUrl
 * @return {Promise}
 */
const requestSignature = async (args, accessToken, webhookUrl) => {

    let dsApiClient = new docusign.ApiClient();
    dsApiClient.setBasePath(args.basePath + '/restapi/');
    dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + accessToken);
    let envelopesApi = new docusign.EnvelopesApi(dsApiClient);
    let results = null;
    // Step 1. Make the envelope request body
    let envelopeOptions = await makeEnvDefinition(args.envelopeArgs, args.docs, webhookUrl);
    // Step 2. call Envelopes::create API method
    // Exceptions will be caught by the calling function
    results = await envelopesApi.createEnvelope(args.accountId, envelopeOptions);
    return results;
};

/**
 * Create envelope definition.
 * @param {Object} args
 * @param {Object} docs
 * @param {String} webhookUrl
 * @return {Promise}
 */
const makeEnvDefinition = async (args, docs, webhookUrl) => {

    const envObject = {
        documents:
            docs.map((doc, idx) => {
                return {
                    documentBase64: doc.doc.toString('base64'),
                    documentId: `${idx + 1}`,
                    fileExtension: doc.fileExtension,
                    name: doc.name || doc.fileName
                };
            }),
        emailSubject: args.subject,
        emailBlurb: args.message,
        recipients: {
            signers:
                args.signers.AND.map((user, idx) => {
                    return {
                        email: user.email,
                        name: user.name,
                        recipientId: `${idx + 1}`
                    };
                })
        },
        status: 'sent',
        eventNotification: {
            useSoapInterface: false,
            URL: webhookUrl,
            loggingEnabled: 'true',
            requireAcknowledgment: 'true',
            eventData: {
                version: 'restv2.1',
                format: 'json',
                includeData: [
                    'tabs'
                ]
            },
            envelopeEvents: [
                {
                    envelopeEventStatusCode: 'completed'
                }
            ],
            recipientEvents: []
        }
    };
    return {
        cdseMode: '',
        changeRoutingOrder: 'true',
        completedDocumentsOnly: 'false',
        mergeRolesOnDraft: '',
        tabLabelExactMatches: '',
        envelopeDefinition: envObject
    };
};

/**
 * Register of specific events to watch.
 * @param {Object} args
 * @param {String} args.basePath
 * @param {Object} args.events
 * @param {String} args.accountId
 * @param {String} accessToken
 * @param {String} webhookUrl
 * @return {Promise}
 */
const registerDocusignWebhook = async (args, accessToken, webhookUrl) => {

    let dsApiClient = new docusign.ApiClient();
    dsApiClient.setBasePath(args.basePath + '/restapi/');
    dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + accessToken);
    let connectApi = new docusign.ConnectApi(dsApiClient);
    let connectCustomConfiguration = {
        configurationType: 'custom',
        urlToPublishTo: webhookUrl,
        allUsers: 'true',
        name: `Appmixer-${args.events.join('|')}`,
        deliveryMode: 'SIM',
        allowEnvelopePublish: 'true',
        enableLog: 'true',
        eventData: {
            version: 'restv2.1'
        },
        events: args.events
    };
    let data = await connectApi.createConfiguration(args.accountId, { connectCustomConfiguration });
    let { connectId, urlToPublishTo } = data;
    return { connectId, urlToPublishTo };
};

/**
 * Delete registered webhook.
 * @param {Object} args
 * @param {String} accessToken
 * @param {String} connectId
 * @return {Promise}
 */
const unregisterDocusignWebhook = async (args, accessToken, connectId) => {

    let dsApiClient = new docusign.ApiClient();
    dsApiClient.setBasePath(args.basePath + '/restapi/');
    dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + accessToken);
    let connectApi = new docusign.ConnectApi(dsApiClient);
    await connectApi.deleteConfiguration(args.accountId, connectId);
};

module.exports = { getAccessToken, getEnvelope, requestSignature, registerDocusignWebhook, unregisterDocusignWebhook };

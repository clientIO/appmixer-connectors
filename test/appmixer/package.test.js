// Loop through all the package.json files and test them.

const path = require('path');
const assert = require('assert');
const _ = require('lodash');
const { getPackageJsonFiles } = require('./utils');

describe('package.json', () => {

    const packageJsonFiles = getPackageJsonFiles(path.join(__dirname, '..', '..', 'src', 'appmixer'));
    packageJsonFiles.forEach(file => {

        const packageJson = require(path.join(file));
        const relativePath = path.relative(path.join(__dirname, '..', '..'), file);

        describe(relativePath, () => {

            it('dependencies', () => {

                const ignoredFiles = [
                    { file: 'calendly/package.json', dependencies: ['bluebird', 'request', 'request-promise'] },
                    { file: 'clearbit/package.json', dependencies: ['bluebird', 'clearbit', 'lodash'] },
                    { file: 'evernote/package.json', dependencies: ['bluebird', 'evernote', 'xmldoc'] },
                    { file: 'facebook/package.json', dependencies: ['bluebird', 'fbgraph'] },
                    { file: 'fakturoid/package.json', dependencies: ['bluebird', 'request', 'request-promise'] },
                    { file: 'github/package.json', dependencies: ['bluebird'] },
                    { file: 'google/package.json', dependencies: ['bluebird', 'google-auth-library', 'googleapis', 'lodash', 'mimelib', 'parse-gmail-email', 'querystring'] },
                    { file: 'highrise/package.json', dependencies: ['bluebird', 'check-types', 'moment', 'node-highrise-api', 'request', 'request-promise'] },
                    { file: 'highrise/sync/SyncSource/package.json', dependencies: ['bluebird'] },
                    { file: 'mandrill/package.json', dependencies: ['mandrill-api'] },
                    { file: 'utils/email/SendEmail/package.json', dependencies: ['mandrill-api'] },
                    { file: 'mandrill/messages/SendEmail/package.json', dependencies: ['bluebird', 'mandrill-api'] },
                    { file: 'mandrill/messages/SendTemplate/package.json', dependencies: ['bluebird', 'lodash', 'mandrill-api'] },
                    { file: 'mandrill/templates/ListTemplates/package.json', dependencies: ['bluebird', 'mandrill-api'] },
                    { file: 'merk/package.json', dependencies: ['bluebird', 'request', 'request-promise'] },
                    { file: 'microsoft/package.json', dependencies: ['bluebird', 'moment', 'request', 'request-promise'] },
                    { file: 'pipedrive/package.json', dependencies: ['bluebird', 'pipedrive'] },
                    { file: 'raynet/package.json', dependencies: ['bluebird', 'request', 'request-promise'] },
                    { file: 'sageone/package.json', dependencies: ['bluebird', 'form-urlencoded', 'request', 'request-promise', 'oauth-signature'] },
                    { file: 'salesforce/package.json', dependencies: ['bluebird', 'request-promise'] },
                    { file: 'trello/package.json', dependencies: ['bluebird', 'node-trello', 'oauth'] },
                    { file: 'userengage/package.json', dependencies: ['bluebird', 'request', 'request-promise'] },
                    { file: 'utils/package.json', dependencies: ['bluebird', 'request', 'request-promise'] },
                    { file: 'utils/tasks/package.json', dependencies: ['bluebird', 'check-types', 'crypto', 'lodash', 'mandrill-api', 'request', 'request-promise', 'uuid'] },
                    { file: 'utils/test/Assert/package.json', dependencies: ['chai', 'lodash'] },
                    { file: 'utils/test/BeforeAll/package.json', dependencies: ['uuid'] },
                    { file: 'utils/timers/package.json', dependencies: ['cron-parser', 'moment'] },
                    { file: 'verifyemail/package.json', dependencies: ['request', 'request-promise'] },
                    { file: 'wordpress/package.json', dependencies: ['bluebird', 'request', 'request-promise'] },
                    { file: 'webflow/cms/package.json', dependencies: ['bluebird', 'webflow-api'] },
                    { file: 'zendesk/package.json', dependencies: ['bluebird', 'moment', 'request', 'request-promise', 'uuid'] },
                    { file: 'utils/language/ListTranslateTargetLanguages/package.json', dependencies: ['@google-cloud/translate'] },
                    { file: 'utils/language/Translate/package.json', dependencies: ['@google-cloud/translate'] },
                    { file: 'utils/language/DetectLanguage/package.json', dependencies: ['@google-cloud/translate'] },
                    { file: 'utils/http/package.json', dependencies: ['axios', 'content-type', 'qs'] },
                    { file: 'utils/http/Uptime/package.json', dependencies: ['moment', 'request', 'request-promise'] },
                    { file: 'utils/filters/package.json', dependencies: ['moment'] },
                    { file: 'raynet/crm/NewPerson/package.json', dependencies: ['moment', 'request-promise'] },
                    { file: 'jira/package.json', dependencies: ['moment', 'request-promise'] },
                    { file: 'google/calendar/EventStart/package.json', dependencies: ['moment', 'moment-timezone'] },
                    { file: 'onesignal/notifications/SendPushNotification/package.json', dependencies: ['request', 'request-promise'] },
                    { file: 'linkedin/shares/CreatePost/package.json', dependencies: ['request', 'request-promise'] },
                    { file: 'lametric/package.json', dependencies: ['request', 'request-promise'] },
                    { file: 'utils/http/DynamicWebhook/package.json', dependencies: ['json-pointer'] },
                    { file: 'asana/package.json', dependencies: ['asana', 'bluebird', 'request', 'request-promise'] },
                    { file: 'blackboard/package.json', dependencies: ['form-data'] },
                    { file: 'typeform/package.json', dependencies: ['@typeform/api-client'] },
                    { file: 'plivo/package.json', dependencies: ['plivo'] },
                    { file: 'userengage/users/FindByEmail/package.json', dependencies: ['name-parser'] },
                    { file: 'hubspot/package.json', dependencies: ['axios', 'bluebird', 'request', 'request-promise'] },
                    { file: 'google/spreadsheets/NewRow/package.json', dependencies: ['deep-diff'] },
                    { file: 'freshdesk/package.json', dependencies: ['axios', 'form-data', 'mime-types', 'moment', 'request', 'request-promise'] },
                    { file: 'google/analytics/package.json', dependencies: ['googleapis', 'request', 'request-promise'] },
                    { file: 'google/spreadsheets/package.json', dependencies: ['googleapis'] },
                    { file: 'google/gmail/package.json', dependencies: ['googleapis', 'mailcomposer'] },
                    { file: 'google/calendar/package.json', dependencies: ['googleapis'] },
                    { file: 'google/bigquery/package.json', dependencies: ['googleapis', '@google-cloud/bigquery'] }
                ];

                // Assert that all dependencies in the package.json are in "version only" format. No range, no URL, no git.
                _.forEach(packageJson.dependencies, (version, dependency) => {
                    // Skip appmixer-lib
                    if (dependency === 'appmixer-lib') {
                        return;
                    }

                    const isIgnoredFile = _.find(ignoredFiles, (ignoredFile) => {
                        // Current file ends with the ignored file path.
                        return file.endsWith(ignoredFile.file) && _.includes(ignoredFile.dependencies, dependency);
                    });
                    if (isIgnoredFile) {
                        return;
                    }

                    assert.match(version, /^\d+\.\d+\.\d+$/, `Dependency ${dependency} has version ${version} which is not an exact version format.`);
                });
            });
        });
    });
});

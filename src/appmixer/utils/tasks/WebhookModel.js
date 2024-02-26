'use strict';

module.exports = context => {

    class WebhookModel extends context.db.Model {

        static get STATUS_SENT() { return 'sent'; };
        static get STATUS_FAIL() { return 'fail'; };
        static get STATUS_PENDING() { return 'pending'; };

        static get collection() {

            return 'webhooks';
        }

        static get idProperty() {

            return 'webhookId';
        }

        static get properties() {

            return [
                'webhookId',
                'url',
                'taskId',
                'status',
                'error',
                'created',
                'mtime'
            ];
        }
    }

    WebhookModel.createSettersAndGetters();

    return WebhookModel;
};

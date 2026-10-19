'use strict';

module.exports = context => {

    /**
     * Name: pluginAppmixerSlackSlack_tasks
     */
    class SlackTaskModel extends context.db.Model {

        static get STATUS_PENDING() { return 'pending'; }
        static get STATUS_REJECTED() { return 'rejected'; }
        static get STATUS_APPROVED() { return 'approved'; }
        static get STATUS_ERROR() { return 'error'; } // For slack-resubmit-failed-webhooks job
        static get STATUS_DUE() { return 'due'; }
        static get collection() { return 'slack_tasks'; }
        static get idProperty() { return 'taskId'; }
        static get properties() {
            return [
                'taskId',
                'title',
                'description',
                'status',
                'flowId',
                'approver', // Slack user ID
                'requester', // Slack user ID
                'decisionBy',
                'decisionMade',
                'actor', // Slack user ID who made the decision
                'channel', // Slack channel ID for notifications
                'webhookUrl', // URL of the Appmixer component that created this task
                'created',
                'mtime',
                'isApprover',
                'webhookAttempts', // Number of failed webhook deliveries
                'nextAttemptAt', // Earliest time of the next resubmit of a failed webhook
                'failedStatus' // Status that failed to be delivered to the webhook
            ];
        }
    }

    SlackTaskModel.createSettersAndGetters();

    return SlackTaskModel;
};

'use strict';
module.exports = context => {

    class TaskModel extends context.db.Model {

        static get STATUS_PENDING() {

            return 'pending';
        };

        static get STATUS_REJECTED() {

            return 'rejected';
        };

        static get STATUS_APPROVED() {

            return 'approved';
        };

        static get STATUS_DUE() {

            return 'due';
        };

        static get collection() {

            return 'tasks';
        }

        static get idProperty() {

            return 'taskId';
        }

        static get properties() {

            return [
                'taskId',
                'title',
                'description',
                'status',
                'flowId',
                'approver',
                'requester',
                'decisionBy',
                'decisionMade',
                'public',
                'approverSecret',
                'requesterSecret',
                'created',
                'mtime',
                'isApprover'
            ];
        }

        static get protectedProperties() {

            return ['approverSecret', 'requesterSecret'];
        }

        /**
         * Resolve if given user is the approver based on logged user's email or secret provided and add it to properties
         * @param user
         * @param secret
         */
        addIsApprover(user, secret = null) {

            let isApprover;
            if (secret === this.getApproverSecret()) {
                isApprover = true;
            } else {
                isApprover = !user.getId().equals(
                    context.constants.PUBLIC_USER_ID) && user.getEmail() === this.getApprover();
            }
            this.setIsApprover(isApprover);
            return this;
        }
    }

    TaskModel.createSettersAndGetters();

    return TaskModel;
};


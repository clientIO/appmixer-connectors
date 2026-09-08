'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function (context) {
        let { taskId, operation, selectedType, userIds = [], teamIds = [], companyIds = [] } = context.messages.in.content;

        let q = {};

        let resp = await lib.callAPI(
            context,
            "GET",
            `/projects/api/v3/tasks/${taskId}.json`,
            null,
            q,
        )

        if (!resp.task) {
            throw new Error(`Task not found`);
        }

        const { assigneeUserIds, assigneeTeamIds, assigneeCompanyIds, createdByUserId } = resp.task;

        const taskAssignees = {};

        if (['add', 'reassign'].includes(operation)) {
            const taskPeopleResp = await lib.callAPI(
                context,
                "GET",
                `/tasks/${taskId}/people.json`,
                null,
                {
                    onlyInPrivacy: true,
                },
            );

            const taskPeople = taskPeopleResp.people;

            if (userIds.length || selectedType === 'task-creator') {
                // We can only assign people who have access to the task
                const userIdsToAssign = taskPeople
                    .filter((person) => {
                        const id = parseInt(person.id, 10);
                        if (selectedType === 'task-creator') {
                            return parseInt(createdByUserId, 10) === id;
                        }
                        return userIds.includes(id.toString());
                    })
                    .map(({ id }) => parseInt(id, 10));

                // We only want the action to succeed if we can assign
                // all users listed in the automation.
                if (!userIdsToAssign.length || (selectedType === 'selected' && userIdsToAssign.length !== userIds.length)) {
                    throw new Error('One or more users do not have access to the task and cannot be set as assignees');
                }
            }
            if (operation === 'reassign') {
                if (selectedType === 'task-creator') {
                    taskAssignees.userIds = [createdByUserId];
                } else if (userIds.length) {
                    taskAssignees.userIds = [...userIds];
                } else { taskAssignees.userIds = []; }

                if (teamIds.length) {
                    taskAssignees.teamIds = [...teamIds];
                } else { taskAssignees.teamIds = []; }
                if (companyIds.length) {
                    taskAssignees.companyIds = [...companyIds];
                } else { taskAssignees.companyIds = []; }
            } else {
                // Add the users already assigned to the task so they are not removed.
                if (selectedType === 'task-creator') {
                    taskAssignees.userIds = Array.from(
                        new Set([createdByUserId, ...(assigneeUserIds || [])]),
                    );
                } else {
                    taskAssignees.userIds = Array.from(
                        new Set([...userIds, ...(assigneeUserIds || [])]),
                    );
                }
                taskAssignees.teamIds = Array.from(
                    new Set([...teamIds, ...(assigneeTeamIds || [])]),
                );
                taskAssignees.companyIds = Array.from(
                    new Set([...companyIds, ...(assigneeCompanyIds || [])]),
                );
            }
        } else {
            // If the task has no assignees, we dont need to remove any
            if ((!assigneeUserIds || assigneeUserIds.length === 0)
                && (!assigneeTeamIds || assigneeTeamIds.length === 0)
                && (!assigneeCompanyIds || assigneeCompanyIds.length === 0)) return {};

            if (operation === 'removeAllAssignees') {
                taskAssignees.userIds = [];
                taskAssignees.teamIds = [];
                taskAssignees.companyIds = [];
            } else {
                if (selectedType === 'task-creator') {
                    taskAssignees.userIds = assigneeUserIds.filter(
                        (id) => (parseInt(id, 10)) !== parseInt(createdByUserId, 10),
                    );
                } else if (userIds.length) {
                    taskAssignees.userIds = assigneeUserIds.filter(
                        (id) => !userIds.includes(id.toString()),
                    );
                } else {
                    taskAssignees.userIds = assigneeUserIds;
                }

                if (teamIds.length) {
                    taskAssignees.teamIds = assigneeTeamIds.filter(
                        (id) => !teamIds.includes(id.toString()),
                    );
                } else if (assigneeTeamIds) {
                    taskAssignees.teamIds = assigneeTeamIds;
                }

                if (companyIds.length) {
                    taskAssignees.companyIds = assigneeCompanyIds.filter(
                        (id) => !companyIds.includes(id.toString()),
                    );
                } else if (assigneeCompanyIds) {
                    taskAssignees.companyIds = assigneeCompanyIds;
                }
            }
        }

        let responsiblePartyIds = [];
        const taskInfo = {
            id: taskId,
            notify: false,
        };

        if (taskAssignees.userIds?.length) {
            responsiblePartyIds = taskAssignees.userIds;
        }

        // team ids are just added to the array with a 't' prefix
        if (taskAssignees.teamIds?.length) {
            responsiblePartyIds = [...responsiblePartyIds, ...taskAssignees.teamIds.map((id) => `t${id}`)];
        }

        // company ids are just added to the array with a 'c' prefix
        if (taskAssignees.companyIds?.length) {
            responsiblePartyIds = [...responsiblePartyIds, ...taskAssignees.companyIds.map((id) => `c${id}`)];
        }

        taskInfo['responsible-party-id'] = responsiblePartyIds.join(',');

        await lib.callAPI(
            context,
            "PUT",
            `/tasks/${taskId}.json`,
            {
                "todo-item": taskInfo,
            },
        )

        context.sendJson({
            taskId: taskId,
            assignees: taskAssignees,
            operation: operation,
            selectedType: selectedType,
            userIds: userIds,
            teamIds: teamIds,
            companyIds: companyIds,
        }, 'assignees');
    }
}

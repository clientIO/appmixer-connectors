'use strict';
const Promise = require('bluebird');

/**
 * Process employees to find newly deleted.
 * @param {Array} currentEmployees
 * @param {Array} deletedEmployees
 * @param {Object} employeeId
 */


function processEmployees(currentEmployees, deletedEmployees, employeeId) {
    if (!currentEmployees.includes(employeeId)) {
        deletedEmployees.push(employeeId);
    }
}

/**
 * Component which triggers whenever an employee is deleted.
 */
class DeletedEmployee {

    async receive(context) {
        try {
            const auth = 'Basic ' + context.auth.token;
            let hibobEndpoint = 'https://api.hibob.com/v1/people/search';

            const { data } = await context.httpRequest({
                url: hibobEndpoint,
                method: "POST",
                headers: {
                    Authorization: auth,
                },
                data: {
                    "humanReadable": "APPEND",
                    "showInactive": true,
                    "fields": [
                        "/root/firstName",
                        "/root/surname",
                        "/root/id",
                        "/root/email",
                        "/internal/status",
                        "/work/manager"
                    ]
                },
                json: true
            });

            let known = Array.isArray(context.state.known) ? new Set(context.state.known) : new Set();
            let current = (data.employees || []).map(employee => employee.id);
            let diff = [];

            if (known.size > 0) {
                known.forEach(processEmployees.bind(null, current, diff));
            }

            await Promise.map(diff, employee => {
                // TODO: Add logging here
                return context.sendJson({ employee }, 'out');
            });

            await context.saveState({
                known: current
            });
        } catch (error) {
            // TODO: Add logging here
            throw error;
        }


    }
}

module.exports = new DeletedEmployee("maesn.hibob.employees.DeletedEmployee");


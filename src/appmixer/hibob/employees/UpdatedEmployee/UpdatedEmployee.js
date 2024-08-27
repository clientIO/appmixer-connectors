'use strict';
const Promise = require('bluebird');

/**
 * Process employees to find newly updated.
 * @param {Array} knownEmployees
 * @param {Array} currentEmployees
 * @param {Array} updatedEmployees
 * @param {Object} employee
 */

function processEmployees(knownEmployees, currentEmployees, updatedEmployees, employee) {
    let employeeId = employee.id;
    let foundEmployee = knownEmployees.find(emp => emp.id === employeeId)

    if (foundEmployee && !isEqual(foundEmployee, employee)) {
        updatedEmployees.push(employee);
    }
    currentEmployees.push(employee);
}


function isEqual(obj1, obj2) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
}

/**
 * Component which triggers whenever new employee is updated.
 */

class UpdatedEmployee {

    async receive(context) {
        try {
            const auth = 'Basic ' + context.auth.token;
            const { storeId } = context.properties;
            const key = 'HiBobEmployeeStorage' + context.flowId;

            let hibobEndpoint = 'https://api.hibob.com/v1/people/search';

            const { data } = await context.httpRequest({
                url: hibobEndpoint,
                method: 'POST',
                headers: {
                    Authorization: auth
                },
                data: {
                    'humanReadable': 'APPEND',
                    'showInactive': true,
                    'fields': [
                        '/root/firstName',
                        '/root/surname',
                        '/root/id',
                        '/root/email',
                        '/internal/status',
                        '/work/manager'
                    ]
                },
                json: true
            });


            let storage = await context.store.get(storeId, key);
            let known = [];

            if (storage && storage.value) {
                known = storage.value;
            };

            let current = [];
            let updated = [];

            if (data.employees && known) {
                data.employees.forEach(processEmployees.bind(null, known, current, updated));
            }

            await Promise.map(updated, employee => {
                return context.sendJson(employee, 'employee');
            });


            await context.store.set(storeId, key, current);
        } catch (error) {
            // TODO: Add logging here
            throw error;
        }
    }
}

module.exports = new UpdatedEmployee('maesn.hibob.employees.UpdatedEmployee');

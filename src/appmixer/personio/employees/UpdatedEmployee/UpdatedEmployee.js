'use strict';
const Promise = require('bluebird');
const axios = require('axios');
const commons = require('../../personio-commons');

/**
 * Process employees to find newly updated.
 * @param {Array} knownEmployees
 * @param {Array} currentEmployees
 * @param {Array} updatedEmployees
 * @param {Object} employee
 */

function processEmployees(knownEmployees, currentEmployees, updatedEmployees, employee) {
    let employeeId = employee.attributes.id.value;
    let foundEmployee = knownEmployees.find(emp => emp.attributes.id.value === employeeId)

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
            let access_token = await commons.getBearerToken(context);
            const authorization = 'Bearer ' + access_token;
            const { storeId } = context.properties;
            const key = 'PersonioEmployeeStorage' + context.flowId;

            let personioEndpoint = 'https://api.personio.de/v1/company/employees';

            let response = await axios.get(personioEndpoint, {
                headers: {
                    'Authorization': authorization,
                    'X-Personio-Partner-ID': 'X-Personio-Partner-ID: MAESN',
                    'X-Personio-App-ID': 'X-Personio-App-ID:MAESN+YOKOY'
                }
            });

            let storage = await context.store.get(storeId, key);
            let known = [];

            if (storage && storage.value) {
                known = storage.value;
            };

            let current = [];
            let updated = [];

            if (response.data.data && known) {
                response.data.data.forEach(processEmployees.bind(null, known, current, updated));
            }

            await Promise.map(updated, employee => {
                // TODO: Add logging here
                return context.sendJson(employee, 'employee');
            });

            await context.store.set(storeId, key, current);
        } catch (error) {
            // TODO: Add logging here
            throw error;
        }
    }
}

module.exports = new UpdatedEmployee("maesn.personio.employees.UpdatedEmployee");


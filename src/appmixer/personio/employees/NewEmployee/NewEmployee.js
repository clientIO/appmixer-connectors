'use strict';
const Promise = require('bluebird');
const axios = require('axios');
const commons = require('../../personio-commons');

/**
 * Process employees to find newly added.
 * @param {Set} knownEmployees
 * @param {Array} currentEmployees
 * @param {Array} newEmployees
 * @param {Object} employee
 */
function processEmployees(knownEmployees, currentEmployees, newEmployees, employee) {
    const employeeId = employee.attributes.id.value;


    if (knownEmployees && !knownEmployees.has(employeeId)) {
        newEmployees.push(employee);
    }
    currentEmployees.push(employeeId);
}

/**
 * Component which triggers whenever new employee is added.
 */

class NewEmployee {

    async receive(context) {
        try {
            let accessToken = await commons.getBearerToken(context);
            const authorization = 'Bearer ' + accessToken;
            let personioEndpoint = 'https://api.personio.de/v1/company/employees';

            let response = await axios.get(personioEndpoint, {
                headers: {
                    'Authorization': authorization,
                    'X-Personio-Partner-ID': 'MAESN',
                    'X-Personio-App-ID': 'MAESN+YOKOY'
                }
            });

            let known = Array.isArray(context.state.known) ? new Set(context.state.known) : new Set();
            let current = [];
            let diff = [];

            if (response.data.data) {
                response.data.data.forEach(processEmployees.bind(null, known, current, diff));
            }

            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            for (const employee of diff) {
                await context.sendJson(employee, 'employee');
                // TODO: Add logging here
                await delay(1000);
            }

            await context.saveState({
                known: current
            });
        } catch (error) {
            this.logError(error);
            throw error;
        }
    }
}

module.exports = new NewEmployee('maesn.personio.employees.NewEmployee');


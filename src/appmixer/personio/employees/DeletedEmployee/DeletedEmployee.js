'use strict';
const Promise = require('bluebird');
const axios = require('axios');
const commons = require('../../personio-commons');

/**
 * Process employees to find newly deleted.
 * @param {Array} currentEmployees
 * @param {Array} deletedEmployees
 * @param {Object} employeeId
 */


function processEmployees(currentEmployees, deletedEmployees, employeeEmail) {
    if (!currentEmployees.includes(employeeEmail)) {
        deletedEmployees.push(employeeEmail);
    }
}

/**
 * Component which triggers whenever an employee is deleted.
 */
class DeletedEmployee {

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
            let current = (response.data.data || []).map(employee => employee.attributes.email.value);
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

module.exports = new DeletedEmployee('maesn.personio.employees.DeletedEmployee');

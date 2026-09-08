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


function processEmployees(currentEmployees, deletedEmployees, knownEmployee) {
    if (!currentEmployees.some(employee => employee.email === knownEmployee.email)) {
        deletedEmployees.push(knownEmployee);
    }
}


/**
 * Component which triggers whenever an employee is deleted.
 */
class DeletedEmployeeEmailAndOrg {

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

            let current = (response.data.data || []).map(employee => {
                const email = employee.attributes.email?.value || null;
                const subcompany = employee.attributes.subcompany?.value?.attributes?.name || null;
                return {
                    email,
                    subcompany
                };
            });

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

module.exports = new DeletedEmployeeEmailAndOrg('maesn.personio.employees.DeletedEmployeeEmailAndOrg');
